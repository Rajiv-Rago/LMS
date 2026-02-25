import { env } from "@/lib/env";
import type { EmailProvider, EmailMessage, SendResult } from "../types";

export class SESEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      // Dynamic import — optional SDK, only needed when EMAIL_PROVIDER=ses
      // @ts-expect-error: @aws-sdk/client-ses is an optional peer dependency
      const { SESClient, SendEmailCommand } = await import(/* webpackIgnore: true */ "@aws-sdk/client-ses");

      const client = new SESClient({ region: env.AWS_REGION || "us-east-1" });

      await client.send(
        new SendEmailCommand({
          Source: env.EMAIL_FROM_ADDRESS || "noreply@example.com",
          Destination: { ToAddresses: [message.to] },
          Message: {
            Subject: { Data: message.subject },
            Body: {
              Html: { Data: message.html },
              ...(message.text && { Text: { Data: message.text } }),
            },
          },
        })
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
