import type { EmailProvider, EmailMessage, SendResult } from "../types";

/**
 * AWS SES email provider — scaffold.
 *
 * To activate:
 * 1. npm install @aws-sdk/client-ses
 * 2. Set EMAIL_PROVIDER=ses in .env
 * 3. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in .env
 *    (or use IAM roles / instance profiles — no keys needed)
 * 4. Set EMAIL_FROM_ADDRESS in .env (must be SES-verified)
 *
 * See docs/INFRASTRUCTURE_SETUP.md for full instructions.
 */
export class SESEmailProvider implements EmailProvider {
  readonly name = "ses" as const;

  private region: string;
  private from: string;

  constructor() {
    this.region = process.env.AWS_REGION || "us-east-1";
    this.from = process.env.EMAIL_FROM_ADDRESS || "noreply@example.com";

    if (!process.env.EMAIL_FROM_ADDRESS) {
      throw new Error(
        "EMAIL_FROM_ADDRESS is required when EMAIL_PROVIDER=ses. " +
          "The address must be verified in your SES console."
      );
    }
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      // Dynamic require so the dependency is only needed when this provider is used.
      // Install: npm install @aws-sdk/client-ses
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ses = require("@aws-sdk/client-ses") as {
        SESClient: new (config: { region: string }) => {
          send: (command: unknown) => Promise<{ MessageId?: string }>;
        };
        SendEmailCommand: new (input: Record<string, unknown>) => unknown;
      };

      const client = new ses.SESClient({ region: this.region });

      const recipients = Array.isArray(message.to)
        ? message.to.map((r) => r.email)
        : [message.to.email];

      const body: Record<string, { Data: string; Charset: string }> = {
        Text: { Data: message.text, Charset: "UTF-8" },
      };
      if (message.html) {
        body.Html = { Data: message.html, Charset: "UTF-8" };
      }

      const command = new ses.SendEmailCommand({
        Source: this.from,
        Destination: { ToAddresses: recipients },
        Message: {
          Subject: { Data: message.subject, Charset: "UTF-8" },
          Body: body,
        },
        ...(message.replyTo && {
          ReplyToAddresses: [message.replyTo.email],
        }),
      });

      const result = await client.send(command);

      return { success: true, messageId: result.MessageId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }
}
