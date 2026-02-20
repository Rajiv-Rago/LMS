import { NextRequest } from "next/server";
import { dbConnect } from "@/lib/db";
import Notification from "@/lib/models/Notification";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";

const POLL_INTERVAL_MS = 5_000;
const MAX_DURATION_MS = 60_000;

export async function GET(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        await dbConnect();
      } catch (error) {
        captureException(error, { operation: "SSE db connect error" });
        send("error", { message: "Database connection failed" });
        controller.close();
        return;
      }

      let lastCheck = new Date();
      const startTime = Date.now();

      // Send initial unread count
      try {
        const unreadCount = await Notification.countDocuments({
          userId: user.userId,
          read: false,
        });
        send("unread", { count: unreadCount });
      } catch {
        // Best effort
      }

      const interval = setInterval(async () => {
        if (closed || Date.now() - startTime > MAX_DURATION_MS) {
          clearInterval(interval);
          if (!closed) {
            closed = true;
            controller.close();
          }
          return;
        }

        try {
          const newNotifications = await Notification.find({
            userId: user.userId,
            createdAt: { $gt: lastCheck },
          })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

          if (newNotifications.length > 0) {
            for (const n of newNotifications) {
              send("notification", {
                id: n._id,
                type: n.type,
                title: n.title,
                message: n.message,
                link: n.link,
                read: n.read,
                createdAt: n.createdAt,
              });
            }
            lastCheck = new Date();
          }
        } catch {
          // Best effort — keep the stream alive
        }
      }, POLL_INTERVAL_MS);

      // Cleanup when client disconnects
      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
