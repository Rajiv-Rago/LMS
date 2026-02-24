import { logger } from "@/lib/logger";
import { ConsoleEmailProvider } from "./providers/console";
import type { EmailProvider, SendResult, EmailMessage } from "./types";

export type { EmailProvider, EmailMessage, SendResult, EmailProviderName } from "./types";

/** Cached singleton provider instance */
let _provider: EmailProvider | null = null;

/**
 * Set a custom email provider. Call this at app startup to use a real provider.
 *
 * Example (in a server-side init file or API route):
 *
 *   import { setEmailProvider } from "@/lib/email";
 *   import { SendGridEmailProvider } from "@/lib/email/providers/sendgrid";
 *   setEmailProvider(new SendGridEmailProvider());
 *
 * If not called, defaults to ConsoleEmailProvider (logs emails, doesn't send).
 * See docs/INFRASTRUCTURE_SETUP.md for full setup instructions.
 */
export function setEmailProvider(provider: EmailProvider): void {
  _provider = provider;
  logger.info(`Email provider set: ${provider.name}`);
}

function getProvider(): EmailProvider {
  if (!_provider) {
    _provider = new ConsoleEmailProvider();
    logger.info(`Email provider initialized: ${_provider.name} (default)`);
  }
  return _provider;
}

/**
 * Send an email using the configured provider.
 * Never throws — returns a SendResult with success: false on failure.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  try {
    const provider = getProvider();
    const result = await provider.send(message);

    if (!result.success) {
      logger.error("Email send failed", {
        provider: provider.name,
        error: result.error,
        subject: message.subject,
      });
    }

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Email provider error", { error: msg });
    return { success: false, error: msg };
  }
}

/**
 * Reset the cached provider — useful in tests or when env changes.
 */
export function resetEmailProvider(): void {
  _provider = null;
}
