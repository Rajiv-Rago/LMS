import { env } from "@/lib/env";
import type { IJob } from "@/lib/models/Job";

export interface EnqueueOptions {
  type: string;
  data: Record<string, unknown>;
  userId: string;
  maxAttempts?: number;
}

export interface JobStatusResult {
  id: string;
  status: IJob["status"];
  result?: Record<string, unknown>;
  error?: string;
  attempts: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface QueueAdapter {
  enqueueJob(options: EnqueueOptions): Promise<string>;
  getJobStatus(jobId: string, userId?: string): Promise<JobStatusResult | null>;
}

let adapter: QueueAdapter | null = null;

function getAdapter(): QueueAdapter {
  if (adapter) return adapter;

  if (env.QUEUE_ENABLED) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MongoQueue } = require("./mongoQueue");
    adapter = new MongoQueue();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SyncShim } = require("./syncShim");
    adapter = new SyncShim();
  }

  return adapter!;
}

export async function enqueueJob(options: EnqueueOptions): Promise<string> {
  return getAdapter().enqueueJob(options);
}

export async function getJobStatus(
  jobId: string,
  userId?: string
): Promise<JobStatusResult | null> {
  return getAdapter().getJobStatus(jobId, userId);
}
