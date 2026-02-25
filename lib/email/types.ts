export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  success: boolean;
  error?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<SendResult>;
}
