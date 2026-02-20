import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbConnect } from "@/lib/db";
import Session from "@/lib/models/Session";
import {
  authenticate,
  getTokenFromRequest,
  clearAuthCookie,
  requireCsrf,
} from "@/lib/auth";
import { captureException } from "@/lib/logger";
import { logAuditEvent } from "@/lib/auth/auditLog";

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);
    const token = getTokenFromRequest(request);

    // Invalidate session in DB if we have a valid token
    if (user && token) {
      await dbConnect();
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await Session.deleteOne({ tokenHash, userId: user.userId });

      await logAuditEvent(request, {
        userId: user.userId,
        action: "logout",
        resource: "user",
        resourceId: user.userId,
      });
    }

    const response = NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200 }
    );

    clearAuthCookie(response);
    return response;
  } catch (error) {
    // Still clear the cookie even if session cleanup fails
    captureException(error, { operation: "Logout error" });
    const response = NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200 }
    );
    clearAuthCookie(response);
    return response;
  }
}
