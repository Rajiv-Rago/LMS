import { env } from "@/lib/env";
import type { EmailProvider, EmailMessage, SendResult } from "../types";

export class ResendEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      // Dynamic import — optional SDK, only needed when EMAIL_PROVIDER=resend
      // @ts-expect-error: resend is an optional peer dependency
      const { Resend } = await import(/* webpackIgnore: true */ "resend");

      const resend = new Resend(env.RESEND_API_KEY!);

      await resend.emails.send({
        from: env.EMAIL_FROM_ADDRESS || "noreply@example.com",
        to: message.to,
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
