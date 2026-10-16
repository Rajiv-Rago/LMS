import { NextRequest } from "next/server";
import { POST as generate } from "./generate/route";
import { POST as syllabus } from "./ai/syllabus/route";
import { enqueueJob } from "@/lib/queue";

jest.mock("@/lib/auth", () => ({
  authenticate: jest.fn().mockResolvedValue({ userId: "learner-1", role: "admin" }),
  requireCsrf: jest.fn().mockReturnValue(null),
  requireVerifiedEmail: jest.fn().mockReturnValue(null),
}));
jest.mock("@/lib/db", () => ({ dbConnect: jest.fn() }));
jest.mock("@/lib/models", () => ({ Course: { countDocuments: jest.fn() } }));
jest.mock("@/lib/queue", () => ({ enqueueJob: jest.fn().mockResolvedValue("job-1") }));
jest.mock("@/lib/ai/rateLimit", () => ({
  enforceAIRateLimit: jest.fn().mockResolvedValue({ blocked: false, result: {} }),
  addRateLimitHeaders: jest.fn(),
}));
jest.mock("@/lib/ai/utils/providerResolver", () => ({
  resolveProvider: jest.fn().mockReturnValue({ provider: "gemini", apiKey: "test" }),
}));
jest.mock("@/lib/ai/utils/userPreferences", () => ({ getUserAIPreferences: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe.each([["generate", generate], ["syllabus", syllabus]] as const)("%s planning input", (_name, handler) => {
  async function post(extra: object) {
    return handler(new NextRequest("http://localhost/api/courses", {
      method: "POST",
      body: JSON.stringify({ topic: "Python", estimatedDuration: "4 weeks", ...extra }),
    }));
  }
  it("passes all 20,000 description characters to the generation job", async () => {
    const additionalContext = "学".repeat(20000);
    expect((await post({ additionalContext })).status).toBe(202);
    expect(enqueueJob).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ additionalContext }),
    }));
  });
  it.each([
    [{ additionalContext: "x".repeat(20001) }, "Keep course details to 20,000 characters"],
    [{ topic: "x".repeat(501) }, "Keep the topic to 500 characters"],
  ])("rejects oversized input before enqueueing", async (extra, message) => {
    const response = await post(extra);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain(message);
    expect(enqueueJob).not.toHaveBeenCalled();
  });
});
