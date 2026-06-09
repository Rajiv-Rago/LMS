import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  clearAuthCookie,
  requireCsrf,
} from "@/lib/auth";
import { revokeAuthSession } from "@/lib/auth/sessionRegistry";
import { captureException } from "@/lib/logger";
import { logAuditEvent } from "@/lib/auth/auditLog";

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);
    if (user?.sessionId) {
      await revokeAuthSession(user.sessionId);

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
