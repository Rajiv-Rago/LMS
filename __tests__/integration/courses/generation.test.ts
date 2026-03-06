import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser, createTestCourse } from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";

jest.mock("@/lib/queue", () => ({
  enqueueJob: jest.fn().mockResolvedValue("mock-job-id-123"),
}));

jest.mock("@/lib/ai/rateLimit", () => ({
  enforceAIRateLimit: jest.fn().mockResolvedValue({
    blocked: false,
    result: {
      allowed: true,
      limit: 10,
      used: 1,
      remaining: 9,
      cost: 1,
      resetAt: new Date().toISOString(),
    },
  }),
  addRateLimitHeaders: jest.fn(),
}));

jest.mock("@/lib/ai/utils/providerResolver", () => ({
  resolveProvider: jest.fn().mockReturnValue({
    provider: "openai",
    apiKey: "test-key",
    model: "gpt-4",
  }),
}));

import { POST } from "@/app/api/courses/generate/route";
import { enqueueJob } from "@/lib/queue";
import { enforceAIRateLimit } from "@/lib/ai/rateLimit";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { NextResponse } from "next/server";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
  jest.clearAllMocks();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("POST /api/courses/generate", () => {
  it("returns 401 without auth", async () => {
    const request = buildRequest("POST", "/api/courses/generate", {
      body: { topic: "Python basics", skillLevel: "beginner" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 with missing topic", async () => {
    const { token } = await createTestUser();
    const request = buildRequest("POST", "/api/courses/generate", {
      token,
      body: { skillLevel: "beginner" },
    });
    const response = await POST(request);
    const { status } = await parseResponse(response);

    expect(status).toBe(400);
  });

  it("returns 400 with invalid skillLevel", async () => {
    const { token } = await createTestUser();
    const request = buildRequest("POST", "/api/courses/generate", {
      token,
      body: { topic: "Python basics", skillLevel: "expert" },
    });
    const response = await POST(request);
    const { status } = await parseResponse(response);

    expect(status).toBe(400);
  });

  it("returns 202 with valid input and enqueues job", async () => {
    const { token } = await createTestUser();
    const request = buildRequest("POST", "/api/courses/generate", {
      token,
      body: { topic: "Python basics", skillLevel: "beginner" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{ jobId: string }>(response);

    expect(status).toBe(202);
    expect(data.jobId).toBe("mock-job-id-123");

    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ai.generate-syllabus",
        data: expect.objectContaining({
          topic: "Python basics",
          targetLevel: "beginner",
          includeVideos: true,
        }),
      })
    );
  });

  it("returns 429 when user has 5 generated courses", async () => {
    const { user, token } = await createTestUser();

    for (let i = 0; i < 5; i++) {
      await createTestCourse(user._id, { owner: user._id });
    }

    const request = buildRequest("POST", "/api/courses/generate", {
      token,
      body: { topic: "Python basics", skillLevel: "beginner" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(429);
    expect(data.error).toMatch(/maximum of 5/i);
  });

  it("returns 202 when user has fewer than 5 courses", async () => {
    const { user, token } = await createTestUser();

    for (let i = 0; i < 4; i++) {
      await createTestCourse(user._id, { owner: user._id });
    }

    const request = buildRequest("POST", "/api/courses/generate", {
      token,
      body: { topic: "Python basics", skillLevel: "beginner" },
    });
    const response = await POST(request);
    const { status } = await parseResponse(response);

    expect(status).toBe(202);
  });

  it("returns 429 when rate limited", async () => {
    (enforceAIRateLimit as jest.Mock).mockResolvedValueOnce({
      blocked: true,
      response: NextResponse.json(
        { error: "Daily AI rate limit exceeded." },
        { status: 429 }
      ),
    });

    const { token } = await createTestUser();
    const request = buildRequest("POST", "/api/courses/generate", {
      token,
      body: { topic: "Python basics", skillLevel: "beginner" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(429);
    expect(data.error).toMatch(/rate limit/i);
  });

  it("returns 503 when no AI provider available", async () => {
    (resolveProvider as jest.Mock).mockReturnValueOnce(null);

    const { token } = await createTestUser();
    const request = buildRequest("POST", "/api/courses/generate", {
      token,
      body: { topic: "Python basics", skillLevel: "beginner" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(503);
    expect(data.error).toMatch(/unavailable/i);
  });
});
