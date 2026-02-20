import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import Session from "@/lib/models/Session";
import {
  getTokenFromRequest,
  verifyTokenForRefresh,
  signToken,
  setAuthCookie,
  requireCsrf,
} from "@/lib/auth";
import { getClientIp } from "@/lib/utils/request";
import { captureException } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: "No token provided" },
        { status: 401 }
      );
    }

    // Verify token (allows expired within 1-hour grace window)
    const payload = verifyTokenForRefresh(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    await dbConnect();

    // Verify the old session exists (token hasn't been revoked)
    const oldTokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const existingSession = await Session.findOne({ tokenHash: oldTokenHash });
    if (!existingSession) {
      return NextResponse.json(
        { error: "Session has been revoked" },
        { status: 401 }
      );
    }

    // Verify user still exists and is active
    const user = await User.findById(payload.userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (user.isLocked()) {
      return NextResponse.json(
        { error: "Account is temporarily locked" },
        { status: 423 }
      );
    }

    // Issue new token and rotate session
    const newToken = signToken(user);
    const newTokenHash = crypto.createHash("sha256").update(newToken).digest("hex");

    await Session.findByIdAndUpdate(existingSession._id, {
      tokenHash: newTokenHash,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") || "unknown",
      lastActiveAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const response = NextResponse.json({
      message: "Token refreshed successfully",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    setAuthCookie(response, newToken);
    return response;
  } catch (error) {
    captureException(error, { operation: "Token refresh error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
