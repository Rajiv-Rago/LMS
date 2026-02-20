import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import { forgotPasswordSchema } from "@/lib/validation/authSchemas";
import { logAuditEvent } from "@/lib/auth/auditLog";

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // Store hashed token and expiry (1 hour)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // TODO: Send email via notification interface (Contract 4)
    // For now, log the reset URL to console
    const resetUrl = `${request.nextUrl.origin}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    console.log(`[Password Reset] Token for ${email}: ${resetUrl}`);

    await logAuditEvent(request, {
      userId: user._id.toString(),
      action: "password.reset.request",
      resource: "user",
      resourceId: user._id.toString(),
    });

    return NextResponse.json({
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
