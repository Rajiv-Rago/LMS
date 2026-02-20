import { dbConnect } from "@/lib/db";
import Notification from "@/lib/models/Notification";
import { captureException } from "@/lib/logger";

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function sendNotification(
  notification: NotificationPayload
): Promise<void> {
  try {
    await dbConnect();
    await Notification.create({
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      metadata: notification.metadata,
    });
  } catch (error) {
    // Notification failures should not break the main operation
    captureException(error, {
      operation: "sendNotification",
      notificationType: notification.type,
      userId: notification.userId,
    });
  }
}
