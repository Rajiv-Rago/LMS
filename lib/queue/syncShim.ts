import { getHandler, handlersReady } from "./handlers";
import type { QueueAdapter, EnqueueOptions, JobStatusResult } from "./index";

interface SyncJobResult {
  status: "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
  userId?: string;
  createdAt: Date;
  completedAt: Date;
}

const results = new Map<string, SyncJobResult>();

let counter = 0;

export class SyncShim implements QueueAdapter {
  async enqueueJob(options: EnqueueOptions): Promise<string> {
    // Wait for async handler registration before looking up
    await handlersReady;

    const id = `sync-${++counter}-${Date.now()}`;
    const handler = getHandler(options.type);

    if (!handler) {
      throw new Error(`No handler registered for job type: ${options.type}`);
    }

    const now = new Date();

    try {
      const result = await handler({
        ...options.data,
        userId: options.userId,
      });
      results.set(id, {
        status: "completed",
        result,
        userId: options.userId,
        createdAt: now,
        completedAt: new Date(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      results.set(id, {
        status: "failed",
        error: errorMessage,
        userId: options.userId,
        createdAt: now,
        completedAt: new Date(),
      });
      throw error;
    }

    return id;
  }

  async getJobStatus(jobId: string, userId?: string): Promise<JobStatusResult | null> {
    const job = results.get(jobId);
    if (!job) return null;
    if (userId && job.userId && job.userId !== userId) return null;

    return {
      id: jobId,
      status: job.status,
      result: job.result,
      error: job.error,
      attempts: 1,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }
}
