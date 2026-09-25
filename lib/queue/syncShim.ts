import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Job from "@/lib/models/Job";
import { getHandler, handlersReady } from "./handlers";
import type { QueueAdapter, EnqueueOptions, JobStatusResult } from "./index";

/**
 * SyncShim executes jobs inline (fire-and-forget) when QUEUE_ENABLED=false,
 * but persists job state to the Job collection so status lookups work across
 * processes/workers. Next.js may serve the enqueue POST and subsequent
 * GET /api/jobs/:id from different module instances — an in-memory Map alone
 * would 404 forever even though the job actually completed.
 */
interface MemoryJob {
  status: "pending" | "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
  userId?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Fallback for contexts without a DB (or non-ObjectId userIds in tests).
const memoryResults = new Map<string, MemoryJob>();

function isObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

export class SyncShim implements QueueAdapter {
  async enqueueJob(options: EnqueueOptions): Promise<string> {
    // Wait for async handler registration before looking up
    await handlersReady;

    const handler = getHandler(options.type);
    if (!handler) {
      throw new Error(`No handler registered for job type: ${options.type}`);
    }

    const useDb = isObjectId(options.userId);
    let id: string;

    if (useDb) {
      await dbConnect();
      const job = await Job.create({
        type: options.type,
        data: options.data,
        userId: options.userId,
        status: "pending",
        maxAttempts: options.maxAttempts ?? 1,
      });
      id = job._id.toString();
    } else {
      id = `sync-mem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      memoryResults.set(id, { status: "pending", userId: options.userId, createdAt: new Date() });
    }

    // Fire-and-forget inline execution; state transitions are persisted
    // so any worker/process can observe them.
    handler({
      ...options.data,
      userId: options.userId,
    }).then(
      async (result) => {
        if (useDb) {
          await dbConnect();
          await Job.findByIdAndUpdate(id, {
            $set: { status: "completed", result, completedAt: new Date() },
          });
        } else {
          const mem = memoryResults.get(id);
          if (mem) {
            mem.status = "completed";
            mem.result = result;
            mem.completedAt = new Date();
          }
        }
      },
      async (error) => {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        if (useDb) {
          await dbConnect();
          await Job.findByIdAndUpdate(id, {
            $set: { status: "failed", error: errorMessage, completedAt: new Date() },
          });
        } else {
          const mem = memoryResults.get(id);
          if (mem) {
            mem.status = "failed";
            mem.error = errorMessage;
            mem.completedAt = new Date();
          }
        }
      }
    );

    return id;
  }

  async getJobStatus(jobId: string, userId?: string): Promise<JobStatusResult | null> {
    if (!isObjectId(jobId)) {
      const mem = memoryResults.get(jobId);
      if (!mem) return null;
      if (userId && mem.userId && mem.userId !== userId) return null;
      return {
        id: jobId,
        status: mem.status,
        result: mem.result,
        error: mem.error,
        attempts: 1,
        createdAt: mem.createdAt,
        completedAt: mem.completedAt,
      };
    }

    await dbConnect();
    const filter: Record<string, unknown> = { _id: jobId };
    if (userId) filter.userId = userId;
    const job = await Job.findOne(filter);
    if (!job) return null;

    return {
      id: job._id.toString(),
      status: job.status,
      result: job.result ?? undefined,
      error: job.error,
      attempts: job.attempts,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }
}
