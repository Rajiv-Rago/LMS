import type { EmailProvider, EmailMessage, SendResult } from "../types";

/**
 * Resend email provider — scaffold.
 *
 * To activate:
 * 1. npm install resend
 * 2. Set EMAIL_PROVIDER=resend in .env
 * 3. Set RESEND_API_KEY in .env
 * 4. Set EMAIL_FROM_ADDRESS in .env (must use a verified domain)
 *
 * See docs/INFRASTRUCTURE_SETUP.md for full instructions.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;

  private apiKey: string;
  private from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY is required when EMAIL_PROVIDER=resend. " +
          "See docs/INFRASTRUCTURE_SETUP.md for setup instructions."
      );
    }

    this.apiKey = apiKey;
    this.from =
      process.env.EMAIL_FROM_ADDRESS || "LMS <noreply@example.com>";
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      // Dynamic require so the dependency is only needed when this provider is used.
      // Install: npm install resend
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Resend } = require("resend") as {
        Resend: new (key: string) => {
          emails: {
            send: (msg: Record<string, unknown>) => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };

      const resend = new Resend(this.apiKey);

      const recipients = Array.isArray(message.to)
        ? message.to.map((r) => r.email)
        : [message.to.email];

      const { data, error } = await resend.emails.send({
        from: this.from,
        to: recipients,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo?.email,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }
}
