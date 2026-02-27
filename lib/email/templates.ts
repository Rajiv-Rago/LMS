import { env } from "@/lib/env";

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function passwordResetTemplate(resetUrl: string): EmailTemplate {
  const appName = env.APP_NAME;

  return {
    subject: `${appName} — Password Reset`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your ${appName} account.</p>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
        <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="color: #999; font-size: 12px;">${appName}</p>
      </div>
    `.trim(),
    text: [
      `Password Reset Request`,
      ``,
      `You requested a password reset for your ${appName} account.`,
      `Click the link below to reset your password. This link expires in 1 hour.`,
      ``,
      resetUrl,
      ``,
      `If you didn't request this, you can safely ignore this email.`,
    ].join("\n"),
  };
}
