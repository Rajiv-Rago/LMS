import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import { requireCsrf } from "@/lib/auth";
import { forgotPasswordSchema } from "@/lib/validation/authSchemas";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { captureException } from "@/lib/logger";

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

    // TODO: Send email via notification interface (Contract 4)
    // Token is NOT logged — it would be sent via email in production
    console.log(`[Password Reset] Reset requested for ${email}`);

    await logAuditEvent(request, {
      userId: user._id.toString(),
      action: "password.reset.request",
      resource: "user",
      resourceId: user._id.toString(),
    });

    return NextResponse.json({ message: RESPONSE_MESSAGE });
  } catch (error) {
    captureException(error, { message: "Forgot password error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
