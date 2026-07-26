import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "@/lib/models/User";
import { sendEmail } from "@/lib/email";
import { emailVerificationTemplate } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Generates a verification token, stores its hash on the user, and emails
 * the verification link. Never throws on email failure — logs instead,
 * mirroring the forgot-password flow.
 */
export async function sendVerificationEmail(
  userId: string,
  email: string
): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = await bcrypt.hash(token, 10);

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        verificationToken: hashedToken,
        verificationExpires: new Date(Date.now() + VERIFICATION_EXPIRY_MS),
      },
    }
  );

  const verifyUrl = `${env.APP_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
  const template = emailVerificationTemplate(verifyUrl);
  const result = await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  if (!result.success) {
    logger.warn("Verification email failed to send", {
      userId,
      error: result.error,
    });
  }
}
