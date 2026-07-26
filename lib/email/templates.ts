import { env } from "@/lib/env";

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function emailVerificationTemplate(verifyUrl: string): EmailTemplate {
  const appName = env.APP_NAME;

  return {
    subject: `${appName} — Verify Your Email`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify Your Email</h2>
        <p>Welcome to ${appName}! Please verify your email address to unlock all features.</p>
        <p>Click the link below to verify. This link expires in 24 hours.</p>
        <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
        <p style="color: #666; font-size: 14px;">If you didn't create a ${appName} account, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="color: #999; font-size: 12px;">${appName}</p>
      </div>
    `.trim(),
    text: [
      `Verify Your Email`,
      ``,
      `Welcome to ${appName}! Please verify your email address to unlock all features.`,
      `Click the link below to verify. This link expires in 24 hours.`,
      ``,
      verifyUrl,
      ``,
      `If you didn't create a ${appName} account, you can safely ignore this email.`,
    ].join("\n"),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function courseReportTemplate(params: {
  courseTitle: string;
  courseUrl: string;
  reason: string;
  details?: string;
  reporterEmail: string;
}): EmailTemplate {
  const appName = env.APP_NAME;
  const { courseTitle, courseUrl, reason, details, reporterEmail } = params;

  return {
    subject: `${appName} — Course Reported: ${courseTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Course Reported</h2>
        <p>A course was reported on ${appName}.</p>
        <p><strong>Course:</strong> <a href="${courseUrl}">${escapeHtml(courseTitle)}</a></p>
        <p><strong>Reason:</strong> ${reason}</p>
        ${details ? `<p><strong>Details:</strong> ${escapeHtml(details)}</p>` : ""}
        <p><strong>Reported by:</strong> ${escapeHtml(reporterEmail)}</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="color: #999; font-size: 12px;">${appName}</p>
      </div>
    `.trim(),
    text: [
      `Course Reported`,
      ``,
      `A course was reported on ${appName}.`,
      `Course: ${courseTitle}`,
      courseUrl,
      `Reason: ${reason}`,
      ...(details ? [`Details: ${details}`] : []),
      `Reported by: ${reporterEmail}`,
    ].join("\n"),
  };
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
