import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser } from "../../helpers/fixtures";
import { registerHandler } from "@/lib/queue/handlers";
import { startWorker, stopWorker } from "@/lib/queue/worker";
import Job from "@/lib/models/Job";

jest.setTimeout(30000);

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  stopWorker();
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Queue Worker", () => {
  it("processes a pending job and marks it completed", async () => {
    const { user } = await createTestUser();
    const mockHandler = jest.fn().mockResolvedValue({ testResult: true });
    registerHandler("test.success", mockHandler);

    const job = await Job.create({
      type: "test.success",
      status: "pending",
      userId: user._id,
      data: { input: "hello" },
      maxAttempts: 3,
    });

    await startWorker();
    await wait(4000);
    stopWorker();

    const updated = await Job.findById(job._id);
    expect(updated!.status).toBe("completed");
    expect(updated!.result).toEqual(expect.objectContaining({ testResult: true }));
    expect(updated!.completedAt).toBeDefined();
    expect(mockHandler).toHaveBeenCalled();
  });

  it("retries a failing job then marks it failed after maxAttempts", async () => {
    const { user } = await createTestUser();
    const mockHandler = jest.fn().mockRejectedValue(new Error("handler error"));
    registerHandler("test.fail", mockHandler);

    const job = await Job.create({
      type: "test.fail",
      status: "pending",
      userId: user._id,
      data: {},
      maxAttempts: 2,
    });

    await startWorker();
    await wait(15000);
    stopWorker();

    const updated = await Job.findById(job._id);
    expect(updated!.status).toBe("failed");
    expect(updated!.error).toBe("handler error");
    expect(updated!.attempts).toBeGreaterThanOrEqual(2);
  });

  it("marks job with unknown type as failed", async () => {
    const { user } = await createTestUser();

    const job = await Job.create({
      type: "test.nonexistent",
      status: "pending",
      userId: user._id,
      data: {},
      maxAttempts: 3,
    });

    await startWorker();
    await wait(4000);
    stopWorker();

    const updated = await Job.findById(job._id);
    expect(updated!.status).toBe("failed");
    expect(updated!.error).toContain("No handler registered");
  });

  it("resets stale processing jobs to pending", async () => {
    const { user } = await createTestUser();
    const mockHandler = jest.fn().mockResolvedValue({ recovered: true });
    registerHandler("test.stale", mockHandler);

    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    const job = await Job.create({
      type: "test.stale",
      status: "processing",
      userId: user._id,
      data: {},
      maxAttempts: 3,
      startedAt: sixMinutesAgo,
    });

    await startWorker();
    await wait(6000);
    stopWorker();

    const updated = await Job.findById(job._id);
    expect(updated!.status).toBe("completed");
    expect(mockHandler).toHaveBeenCalled();
  });
});
