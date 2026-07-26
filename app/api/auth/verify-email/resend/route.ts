import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireAuth, JWTPayload } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/auth/emailVerification";
import { enforceRateLimit } from "@/lib/rateLimit";
import { captureException } from "@/lib/logger";

function okResponse(): NextResponse {
  return NextResponse.json({
    message: "If your email is unverified, a verification link has been sent.",
  });
}

async function handler(
  _request: NextRequest,
  _context: { params: Promise<Record<string, string>> },
  user: JWTPayload
): Promise<NextResponse> {
  try {
    await dbConnect();

    if (user.emailVerified) {
      return okResponse();
    }

    // Over the limit → silent 200, no email (same response, no state leakage)
    const limited = await enforceRateLimit("verify-resend", user.userId, 3, "hour");
    if (!limited) {
      await sendVerificationEmail(user.userId, user.email);
    }

    return okResponse();
  } catch (error) {
    captureException(error, { operation: "Resend verification email error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const POST = requireAuth(handler);
