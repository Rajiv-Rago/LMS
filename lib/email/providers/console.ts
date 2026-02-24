import { logger } from "@/lib/logger";
import type { EmailProvider, EmailMessage, SendResult } from "../types";

/**
 * Console email provider — logs emails instead of sending them.
 * Used in development and as a fallback when no real provider is configured.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console" as const;

  async send(message: EmailMessage): Promise<SendResult> {
    const recipients = Array.isArray(message.to)
      ? message.to.map((r) => r.email).join(", ")
      : message.to.email;

    logger.info("[Email] Message logged (console provider)", {
      to: recipients,
      subject: message.subject,
      // Intentionally NOT logging the body — it may contain tokens/links
    });

    return { success: true, messageId: `console-${Date.now()}` };
  }
}
