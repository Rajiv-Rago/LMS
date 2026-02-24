import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import { requireCsrf } from "@/lib/auth";
import { forgotPasswordSchema } from "@/lib/validation/authSchemas";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { captureException } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email/templates";

const RESPONSE_MESSAGE =
  "If an account with that email exists, a password reset link has been sent.";

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const validation = forgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    await dbConnect();

    const user = await User.findOne({ email });

    // Always return success to prevent email enumeration
    if (!user) {
      // Dummy hash to prevent timing-based user enumeration
      await bcrypt.hash("dummy-token", 10);
      return NextResponse.json({ message: RESPONSE_MESSAGE });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // Store hashed token and expiry (1 hour)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Build reset URL and send email via pluggable provider
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    const template = passwordResetEmail(resetUrl);

    await sendEmail({
      to: { email },
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    await logAuditEvent(request, {
      userId: user._id.toString(),
      action: "password.reset.request",
      resource: "user",
      resourceId: user._id.toString(),
    });

    return NextResponse.json({ message: RESPONSE_MESSAGE });
  } catch (error) {
    captureException(error, { operation: "Forgot password error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
