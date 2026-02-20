import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import { requireCsrf } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validation/authSchemas";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { captureException } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const validation = resetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { token, email, password } = validation.data;

    await dbConnect();

    // Find user by email with unexpired reset token
    const user = await User.findOne({
      email,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user || !user.resetPasswordToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    // Verify token against stored hash
    const isValidToken = await bcrypt.compare(token, user.resetPasswordToken);
    if (!isValidToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    // Update password and clear reset fields
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    await logAuditEvent(request, {
      userId: user._id.toString(),
      action: "password.reset.complete",
      resource: "user",
      resourceId: user._id.toString(),
    });

    return NextResponse.json({
      message: "Password has been reset successfully. You can now log in.",
    });
  } catch (error) {
    captureException(error, { message: "Reset password error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
