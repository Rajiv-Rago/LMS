import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser } from "../../helpers/fixtures";
import { registerHandler } from "@/lib/queue/handlers";
import { SyncShim } from "@/lib/queue/syncShim";
import Job from "@/lib/models/Job";

jest.setTimeout(30000);

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("SyncShim durability", () => {
  it("persists job state to Mongo so a fresh instance can read it", async () => {
    const { user } = await createTestUser();
    registerHandler("test.sync-durable", jest.fn().mockResolvedValue({ courseId: "c-1" }));

    const shimA = new SyncShim();
    const jobId = await shimA.enqueueJob({
      type: "test.sync-durable",
      data: { topic: "x" },
      userId: user._id.toString(),
    });

    // A *different* instance (simulating a different server process/worker)
    // must see the job — this is what GET /api/jobs/:id relies on.
    const shimB = new SyncShim();
    await wait(500);
    const status = await shimB.getJobStatus(jobId, user._id.toString());

    expect(status).not.toBeNull();
    expect(status!.status).toBe("completed");
    expect(status!.result).toEqual(expect.objectContaining({ courseId: "c-1" }));

    const doc = await Job.findById(jobId);
    expect(doc).not.toBeNull();
    expect(doc!.status).toBe("completed");
  });

  it("records failures durably", async () => {
    const { user } = await createTestUser();
    registerHandler("test.sync-fail", jest.fn().mockRejectedValue(new Error("boom")));

    const shim = new SyncShim();
    const jobId = await shim.enqueueJob({
      type: "test.sync-fail",
      data: {},
      userId: user._id.toString(),
    });

    await wait(500);
    const status = await new SyncShim().getJobStatus(jobId, user._id.toString());
    expect(status!.status).toBe("failed");
    expect(status!.error).toBe("boom");
  });

  it("returns null for unknown jobs (client gives up instead of looping)", async () => {
    const { user } = await createTestUser();
    const status = await new SyncShim().getJobStatus(
      "000000000000000000000000",
      user._id.toString()
    );
    expect(status).toBeNull();
  });
});
