import { NextRequest } from "next/server";
import { authenticate } from "@/lib/auth";
import { getJobStatus } from "@/lib/queue";

const POLL_MS = 2000;
const MAX_DURATION_MS = 4.5 * 60 * 1000;

/**
 * Server-sent events stream for a single job. Pushes `{status, result?, error?}`
 * updates so the client doesn't need to poll. Closes on terminal state
 * (completed/failed), after MAX_DURATION_MS, or when the client disconnects.
 *
 * Usage: new EventSource(`/api/jobs/${jobId}/stream`)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const user = await authenticate(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { jobId } = await params;
  const userId = user.userId;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const startedAt = Date.now();
      // Immediate first check so fast jobs resolve without waiting a tick
      const check = async (): Promise<boolean> => {
        const job = await getJobStatus(jobId, userId);
        if (!job) {
          send("error", { error: "Job not found" });
          return true;
        }
        send("status", {
          status: job.status,
          result: job.result,
          error: job.error ? "Job failed — please try again" : undefined,
        });
        return job.status === "completed" || job.status === "failed";
      };

      try {
        if (await check()) {
          controller.close();
          return;
        }
      } catch {
        controller.close();
        return;
      }

      const timer = setInterval(async () => {
        if (request.signal.aborted) {
          clearInterval(timer);
          controller.close();
          return;
        }
        if (Date.now() - startedAt > MAX_DURATION_MS) {
          send("error", { error: "Timed out waiting for job" });
          clearInterval(timer);
          controller.close();
          return;
        }
        try {
          if (await check()) {
            clearInterval(timer);
            controller.close();
          }
        } catch {
          clearInterval(timer);
          controller.close();
        }
      }, POLL_MS);

      request.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
