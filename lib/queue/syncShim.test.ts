import { SyncShim } from "./syncShim";
import { getHandler } from "./handlers";
import { captureException } from "@/lib/logger";
import Job from "@/lib/models/Job";
import { AIProviderError } from "@/lib/ai/errors";
import { ErrorCodes } from "@/lib/telemetry/errorCodes";

jest.mock("./handlers", () => ({ getHandler: jest.fn(), handlersReady: Promise.resolve() }));
jest.mock("@/lib/db", () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/logger", () => ({ captureException: jest.fn() }));
jest.mock("@/lib/models/Job", () => ({
  __esModule: true,
  default: { create: jest.fn(), findByIdAndUpdate: jest.fn().mockResolvedValue(undefined) },
}));

beforeEach(() => jest.clearAllMocks());

it("logs provider metadata by job ID and persists the failure without logging job input", async () => {
  const id = "000000000000000000000001";
  const error = new AIProviderError({
    provider: "openrouter", model: "openrouter/free", operation: "chat",
    errorCode: ErrorCodes.AI_PROVIDER_RATE_LIMITED, statusCode: 429,
    isTransient: true, originalError: new Error("rate limited"),
  });
  jest.mocked(Job.create).mockResolvedValue({ _id: id } as never);
  jest.mocked(getHandler).mockReturnValue(jest.fn().mockRejectedValue(error));
  await new SyncShim().enqueueJob({
    type: "ai.generate-syllabus", userId: "000000000000000000000002",
    data: { provider: "openrouter", model: "openrouter/free", topic: "Private learner topic" },
  });
  // Wait for the asynchronous failure callback to persist the status.
  await new Promise((resolve) => setImmediate(resolve));
  expect(captureException).toHaveBeenCalledWith(error, {
    operation: "inline-job", jobId: id, jobType: "ai.generate-syllabus",
    requestedProvider: "openrouter", requestedModel: "openrouter/free",
    provider: "openrouter", model: "openrouter/free", errorCode: ErrorCodes.AI_PROVIDER_RATE_LIMITED,
    statusCode: 429, isTransient: true,
  });
  expect(Job.findByIdAndUpdate).toHaveBeenCalledWith(id, expect.objectContaining({
    $set: expect.objectContaining({ status: "failed", error: error.message }),
  }));
});

it("also logs parsing errors for memory-backed jobs and retains their failure status", async () => {
  const error = new Error("Failed to parse AI response as JSON");
  jest.mocked(getHandler).mockReturnValue(jest.fn().mockRejectedValue(error));
  const shim = new SyncShim();
  const id = await shim.enqueueJob({ type: "ai.generate-syllabus", userId: "test-learner", data: {} });
  await new Promise((resolve) => setImmediate(resolve));
  expect(captureException).toHaveBeenCalledWith(error, expect.objectContaining({ jobId: id }));
  expect(await shim.getJobStatus(id, "test-learner")).toMatchObject({ status: "failed", error: error.message });
});
