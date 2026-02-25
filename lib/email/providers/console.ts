import { logger } from "@/lib/logger";
import type { EmailProvider, EmailMessage, SendResult } from "../types";

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<SendResult> {
    logger.info("Email sent (console provider)", {
      to: message.to,
      subject: message.subject,
    });
    return { success: true };
  }
}
