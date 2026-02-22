import { dbConnect } from "@/lib/db";
import Job from "@/lib/models/Job";
import { getHandler, handlersReady } from "./handlers";
import { captureException } from "@/lib/logger";

const POLL_INTERVAL_MS = 2000;
const MAX_CONCURRENT = 2;
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const RETRY_DELAYS = [2000, 4000, 8000]; // exponential backoff

let running = false;
let activeJobs = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function processJob(jobId: string): Promise<void> {
  activeJobs++;
  try {
    const job = await Job.findById(jobId);
    if (!job || job.status !== "processing") return;

    const handler = getHandler(job.type);
    if (!handler) {
      job.status = "failed";
      job.error = `No handler registered for job type: ${job.type}`;
      job.completedAt = new Date();
      await job.save();
      return;
    }

    try {
      const result = await handler({
        ...((job.data as Record<string, unknown>) || {}),
        userId: job.userId.toString(),
      });
      job.status = "completed";
      job.result = result;
      job.completedAt = new Date();
      await job.save();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      job.attempts += 1;

      if (job.attempts >= job.maxAttempts) {
        job.status = "failed";
        job.error = errorMessage;
        job.completedAt = new Date();
        await job.save();
      } else {
        // Schedule retry with exponential backoff
        const delay = RETRY_DELAYS[job.attempts - 1] || 8000;
        job.status = "pending";
        job.error = errorMessage;
        job.startedAt = undefined;
        await job.save();

        // Wait before the job becomes eligible again
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      captureException(error, {
        operation: "Job processing error",
        jobId: job._id.toString(),
        jobType: job.type,
        attempt: job.attempts,
      });
    }
  } finally {
    activeJobs--;
  }
}

async function poll(): Promise<void> {
  if (!running || activeJobs >= MAX_CONCURRENT) return;

  try {
    await dbConnect();

    // Reset stale jobs
    await Job.updateMany(
      {
        status: "processing",
        startedAt: { $lt: new Date(Date.now() - STALE_THRESHOLD_MS) },
      },
      {
        $set: { status: "pending", startedAt: null },
      }
    );

    // Claim a pending job atomically
    const slotsAvailable = MAX_CONCURRENT - activeJobs;
    for (let i = 0; i < slotsAvailable; i++) {
      const job = await Job.findOneAndUpdate(
        { status: "pending" },
        { $set: { status: "processing", startedAt: new Date() } },
        { sort: { createdAt: 1 }, returnDocument: "after" }
      );

      if (job) {
        // Fire and forget — processJob manages its own lifecycle
        processJob(job._id.toString()).catch((err) => {
          captureException(err, { operation: "Worker processJob error" });
        });
      } else {
        break; // No more pending jobs
      }
    }
  } catch (error) {
    captureException(error, { operation: "Worker poll error" });
  }
}

export async function startWorker(): Promise<void> {
  if (running) return;
  running = true;

  // Ensure handlers are loaded
  await handlersReady;

  console.log("[Queue Worker] Started, polling every", POLL_INTERVAL_MS, "ms");
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);

  // Run first poll immediately
  poll().catch(() => {});
}

export function stopWorker(): void {
  running = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  console.log("[Queue Worker] Stopped");
}
