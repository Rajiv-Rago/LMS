import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { captureException } from "@/lib/logger";
import { env } from "@/lib/env";

function redirectTo(result: "success" | "invalid" | "expired"): NextResponse {
  return NextResponse.redirect(
    new URL(`/dashboard?verified=${result}`, env.APP_URL)
  );
}

// Unauthenticated GET — the link is clicked from an email client
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    const email = request.nextUrl.searchParams.get("email");

    if (!token || !email) {
      return redirectTo("invalid");
    }

    await dbConnect();

    const user = await User.findOne({ email }).select(
      "+verificationToken +verificationExpires"
    );

    if (!user) {
      return redirectTo("invalid");
    }

    // Idempotent-friendly: already verified counts as success
    if (user.emailVerifiedAt) {
      return redirectTo("success");
    }

    if (
      !user.verificationToken ||
      !(await bcrypt.compare(token, user.verificationToken))
    ) {
      return redirectTo("invalid");
    }

    if (!user.verificationExpires || user.verificationExpires < new Date()) {
      return redirectTo("expired");
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: { emailVerifiedAt: new Date() },
        $unset: { verificationToken: "", verificationExpires: "" },
      }
    );

    await logAuditEvent(request, {
      userId: user._id.toString(),
      action: "email.verified",
      resource: "user",
      resourceId: user._id.toString(),
    });

    return redirectTo("success");
  } catch (error) {
    captureException(error, { operation: "Email verification error" });
    return redirectTo("invalid");
  }
}
