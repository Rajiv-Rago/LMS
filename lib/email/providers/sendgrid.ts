import type { EmailProvider, EmailMessage, SendResult } from "../types";

/**
 * SendGrid email provider — scaffold.
 *
 * To activate:
 * 1. npm install @sendgrid/mail
 * 2. Set EMAIL_PROVIDER=sendgrid in .env
 * 3. Set SENDGRID_API_KEY in .env
 * 4. Set EMAIL_FROM_ADDRESS and EMAIL_FROM_NAME in .env
 *
 * See docs/INFRASTRUCTURE_SETUP.md for full instructions.
 */
export class SendGridEmailProvider implements EmailProvider {
  readonly name = "sendgrid" as const;

  private apiKey: string;
  private from: { email: string; name: string };

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error(
        "SENDGRID_API_KEY is required when EMAIL_PROVIDER=sendgrid. " +
          "See docs/INFRASTRUCTURE_SETUP.md for setup instructions."
      );
    }

    this.apiKey = apiKey;
    this.from = {
      email: process.env.EMAIL_FROM_ADDRESS || "noreply@example.com",
      name: process.env.EMAIL_FROM_NAME || "LMS",
    };
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      // Dynamic import so the dependency is only required when this provider is used.
      // Install: npm install @sendgrid/mail
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sgMail = require("@sendgrid/mail") as {
        setApiKey: (key: string) => void;
        send: (msg: Record<string, unknown>) => Promise<[{ headers: Record<string, unknown> }]>;
      };
      sgMail.setApiKey(this.apiKey);

      const recipients = Array.isArray(message.to)
        ? message.to.map((r) => ({ email: r.email, name: r.name }))
        : [{ email: message.to.email, name: message.to.name }];

      const [response] = await sgMail.send({
        to: recipients,
        from: this.from,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo
          ? { email: message.replyTo.email, name: message.replyTo.name }
          : undefined,
      });

      return {
        success: true,
        messageId: response?.headers?.["x-message-id"] as string | undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }
}
