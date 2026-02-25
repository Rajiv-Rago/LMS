import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { EmailProvider, EmailMessage, SendResult } from "./types";
import { ConsoleEmailProvider } from "./providers/console";

let provider: EmailProvider | null = null;

async function resolveProvider(): Promise<EmailProvider> {
  switch (env.EMAIL_PROVIDER) {
    case "sendgrid": {
      const { SendGridEmailProvider } = await import("./providers/sendgrid");
      return new SendGridEmailProvider();
    }
    case "ses": {
      const { SESEmailProvider } = await import("./providers/ses");
      return new SESEmailProvider();
    }
    case "resend": {
      const { ResendEmailProvider } = await import("./providers/resend");
      return new ResendEmailProvider();
    }
    case "console":
    default:
      return new ConsoleEmailProvider();
  }
}

async function getProvider(): Promise<EmailProvider> {
  if (!provider) {
    provider = await resolveProvider();
  }
  return provider;
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  try {
    const p = await getProvider();
    return await p.send(message);
  } catch (error) {
    logger.error("Email send failed unexpectedly", {
      to: message.to,
      subject: message.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type { EmailMessage, SendResult, EmailProvider } from "./types";
