import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import {
  getTokenFromRequest,
  verifyTokenForRefresh,
  signToken,
  setAuthCookie,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
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

    // Issue new token
    const newToken = signToken(user);

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
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
