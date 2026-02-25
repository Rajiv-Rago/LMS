import { env } from "@/lib/env";
import type { EmailProvider, EmailMessage, SendResult } from "../types";

export class SendGridEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      // Dynamic import — optional SDK, only needed when EMAIL_PROVIDER=sendgrid
      // @ts-expect-error: @sendgrid/mail is an optional peer dependency
      const sgMail = await import(/* webpackIgnore: true */ "@sendgrid/mail");
      sgMail.default.setApiKey(env.SENDGRID_API_KEY!);

      await sgMail.default.send({
        to: message.to,
        from: env.EMAIL_FROM_ADDRESS || "noreply@example.com",
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
