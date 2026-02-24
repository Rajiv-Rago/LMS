/**
 * Email Service — Provider Interface & Types
 *
 * Pluggable email abstraction. Ships with a ConsoleProvider (dev/test).
 * Swap in a real provider (SendGrid, SES, Resend) by implementing EmailProvider.
 *
 * See docs/INFRASTRUCTURE_SETUP.md for integration instructions.
 */

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailMessage {
  to: EmailAddress | EmailAddress[];
  subject: string;
  /** Plain-text body (always required for accessibility / fallback). */
  text: string;
  /** Optional HTML body. */
  html?: string;
  /** Reply-to address (defaults to from). */
  replyTo?: EmailAddress;
}

export interface SendResult {
  success: boolean;
  /** Provider-specific message ID (undefined for console provider). */
  messageId?: string;
  /** Error message if success is false. */
  error?: string;
}

/**
 * All email providers must implement this interface.
 */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

/**
 * Supported email provider names.
 * Extend this union as new providers are added.
 */
export type EmailProviderName = "console" | "sendgrid" | "ses" | "resend";
