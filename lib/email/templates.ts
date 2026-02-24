/**
 * Email templates for transactional emails.
 *
 * Each template returns { subject, text, html } ready for sendEmail().
 * HTML is intentionally minimal — inline styles for email client compatibility.
 */

const APP_NAME = process.env.APP_NAME || "LMS";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

export function passwordResetEmail(resetUrl: string) {
  const subject = `${APP_NAME} — Reset your password`;

  const text = [
    `You requested a password reset for your ${APP_NAME} account.`,
    "",
    `Click the link below to set a new password (valid for 1 hour):`,
    resetUrl,
    "",
    "If you didn't request this, you can safely ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a;">Reset your password</h2>
      <p>You requested a password reset for your <strong>${APP_NAME}</strong> account.</p>
      <p>Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}"
           style="background: #2563eb; color: #fff; padding: 12px 24px;
                  border-radius: 6px; text-decoration: none; font-weight: 600;">
          Reset Password
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        If you didn't request this, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">${APP_NAME} &middot; ${APP_URL}</p>
    </div>
  `.trim();

  return { subject, text, html };
}

export function welcomeEmail(userName: string) {
  const subject = `Welcome to ${APP_NAME}!`;

  const text = [
    `Hi ${userName},`,
    "",
    `Welcome to ${APP_NAME}! Your account has been created successfully.`,
    "",
    `Get started: ${APP_URL}/dashboard`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a;">Welcome to ${APP_NAME}!</h2>
      <p>Hi <strong>${userName}</strong>,</p>
      <p>Your account has been created successfully.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${APP_URL}/dashboard"
           style="background: #2563eb; color: #fff; padding: 12px 24px;
                  border-radius: 6px; text-decoration: none; font-weight: 600;">
          Go to Dashboard
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">${APP_NAME} &middot; ${APP_URL}</p>
    </div>
  `.trim();

  return { subject, text, html };
}
