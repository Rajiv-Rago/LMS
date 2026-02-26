import { dbConnect } from "@/lib/db";
import Job from "@/lib/models/Job";
import type { QueueAdapter, EnqueueOptions, JobStatusResult } from "./index";

export class MongoQueue implements QueueAdapter {
  async enqueueJob(options: EnqueueOptions): Promise<string> {
    await dbConnect();
    const job = await Job.create({
      type: options.type,
      data: options.data,
      userId: options.userId,
      status: "pending",
      maxAttempts: options.maxAttempts ?? 3,
    });
    return job._id.toString();
  }

  async getJobStatus(jobId: string, userId?: string): Promise<JobStatusResult | null> {
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
