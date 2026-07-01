import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { buildRequest, parseResponse } from "../../helpers/api";
import {
  createTestUser,
  createTestCourse,
  createTestModule,
  resetFixtureCounters,
} from "../../helpers/fixtures";
import { POST as syllabusPost } from "@/app/api/courses/ai/syllabus/route";
import { POST as generateAllPost } from "@/app/api/courses/ai/[courseId]/generate-all/route";
import { POST as moduleGeneratePost } from "@/app/api/courses/ai/[courseId]/modules/[moduleId]/generate/route";
import { POST as lessonGeneratePost } from "@/app/api/courses/ai/[courseId]/lessons/[lessonId]/generate/route";
import { POST as youtubePost } from "@/app/api/courses/youtube/generate/route";
import { Lesson } from "@/lib/models";

// ── Mocks ──────────────────────────────────────────────────────────
// Force resolveProvider to return null so we hit the "not configured" path
jest.mock("@/lib/ai/utils/providerResolver", () => ({
  resolveProvider: jest.fn(() => null),
}));

// getUserAIPreferences → no preferences
jest.mock("@/lib/ai/utils/userPreferences", () => ({
  getUserAIPreferences: jest.fn(() => Promise.resolve(undefined)),
}));

// Rate limiting → always allow
jest.mock("@/lib/ai/rateLimit", () => ({
  enforceAIRateLimit: jest.fn(() =>
    Promise.resolve({
      blocked: false,
      result: { allowed: true, limit: 100, used: 0, remaining: 100, cost: 1, resetAt: new Date().toISOString() },
    })
  ),
  addRateLimitHeaders: jest.fn(),
}));

// enqueueJob → should never be reached when provider is null
jest.mock("@/lib/queue", () => ({
  enqueueJob: jest.fn(() => Promise.resolve("mock-job-id")),
}));

// env → provide YOUTUBE_API_KEY so the YouTube route doesn't bail early
jest.mock("@/lib/env", () => ({
  env: { YOUTUBE_API_KEY: "fake-key", MONGODB_URI: process.env.MONGODB_URI },
}));

// captureException → spy so we can verify it's called
jest.mock("@/lib/logger", () => ({
  captureException: jest.fn(),
}));

import { captureException } from "@/lib/logger";

// ── Setup ──────────────────────────────────────────────────────────
beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
  resetFixtureCounters();
  jest.clearAllMocks();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

// ── Helpers ────────────────────────────────────────────────────────
/** Patterns that must NEVER appear in user-facing error messages */
const LEAKED_PATTERNS = [
  /API key not configured/i,
  /provider.*not configured/i,
  /openai|anthropic|gemini|cerebras/i,
  /YOUTUBE_API_KEY/,
];

function assertNoLeakedDetails(errorMessage: string) {
  for (const pattern of LEAKED_PATTERNS) {
    expect(errorMessage).not.toMatch(pattern);
  }
}

// ── Tests ──────────────────────────────────────────────────────────
describe("AI route error handling — provider not configured", () => {
  it("POST /api/courses/ai/syllabus returns 503 with generic message", async () => {
    const { token } = await createTestUser({ role: "user" });

    const request = buildRequest("POST", "/api/courses/ai/syllabus", {
      token,
      body: {
        topic: "Testing",
        targetLevel: "beginner",
        estimatedDuration: "2 weeks",
      },
    });

    const response = await syllabusPost(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(503);
    expect(data.error).toBe("AI service is temporarily unavailable. Please try again later.");
    assertNoLeakedDetails(data.error);
    expect(captureException).toHaveBeenCalled();
  });

  it("POST /api/courses/ai/[courseId]/generate-all returns 503 with generic message", async () => {
    const { user, token } = await createTestUser({ role: "user" });

    const { course } = await createTestCourse(user._id, {
      owner: user._id,
    });
    course.syllabusStatus = "completed";
    await course.save();

    const { module: mod } = await createTestModule(course._id, {
      title: "Module 1",
    });
    // Set contentStatus to "skeleton" so the module is eligible
    mod.contentStatus = "skeleton";
    await mod.save();

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/generate-all`,
      { token, body: {} }
    );

    const response = await generateAllPost(request, {
      params: Promise.resolve({ courseId: course._id.toString() }),
    });
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(503);
    expect(data.error).toBe("AI service is temporarily unavailable. Please try again later.");
    assertNoLeakedDetails(data.error);
    expect(captureException).toHaveBeenCalled();
  });

  it("POST /api/courses/ai/[courseId]/modules/[moduleId]/generate returns 503 with generic message", async () => {
    const { user, token } = await createTestUser({ role: "user" });

    const { course } = await createTestCourse(user._id, {
      owner: user._id,
    });
    course.syllabusStatus = "completed";
    await course.save();

    const { module: mod } = await createTestModule(course._id);

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/modules/${mod._id}/generate`,
      { token, body: {} }
    );

    const response = await moduleGeneratePost(request, {
      params: Promise.resolve({
        courseId: course._id.toString(),
        moduleId: mod._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(503);
    expect(data.error).toBe("AI service is temporarily unavailable. Please try again later.");
    assertNoLeakedDetails(data.error);
    expect(captureException).toHaveBeenCalled();
  });

  it("POST /api/courses/ai/[courseId]/lessons/[lessonId]/generate returns 503 with generic message", async () => {
    const { user, token } = await createTestUser({ role: "user" });

    const { course } = await createTestCourse(user._id, {
      owner: user._id,
    });
    course.syllabusStatus = "completed";
    await course.save();

    const { module: mod } = await createTestModule(course._id);

    const lesson = await Lesson.create({
      title: "Test Lesson",
      module: mod._id,
      contentType: "text",
      content: "",
      order: 0,
    });

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/lessons/${lesson._id}/generate`,
      { token, body: {} }
    );

    const response = await lessonGeneratePost(request, {
      params: Promise.resolve({
        courseId: course._id.toString(),
        lessonId: lesson._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(503);
    expect(data.error).toBe("AI service is temporarily unavailable. Please try again later.");
    assertNoLeakedDetails(data.error);
    expect(captureException).toHaveBeenCalled();
  });

  it("POST /api/courses/youtube/generate returns 503 with generic message", async () => {
    const { token } = await createTestUser({ role: "user" });

    const request = buildRequest("POST", "/api/courses/youtube/generate", {
      token,
      body: {
        topic: "JavaScript basics",
        skillLevel: "complete_beginner",
      },
    });

    const response = await youtubePost(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(503);
    expect(data.error).toBe("AI service is temporarily unavailable. Please try again later.");
    assertNoLeakedDetails(data.error);
    expect(captureException).toHaveBeenCalled();
  });
});

describe("AI route error handling — catch-all blocks", () => {
  it("POST /api/courses/ai/syllabus returns generic 500 when an unexpected error occurs", async () => {
    const { token } = await createTestUser({ role: "user" });

    // Make enqueueJob throw an internal error
    const { enqueueJob } = jest.requireMock("@/lib/queue") as { enqueueJob: jest.Mock };
    const { resolveProvider } = jest.requireMock("@/lib/ai/utils/providerResolver") as { resolveProvider: jest.Mock };

    // Let provider resolve succeed so we reach enqueueJob
    resolveProvider.mockReturnValueOnce({
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4",
      displayName: "GPT-4",
      providerDisplayName: "OpenAI",
    });

    enqueueJob.mockRejectedValueOnce(
      new Error("MongoServerError: connection pool exhausted")
    );

    const request = buildRequest("POST", "/api/courses/ai/syllabus", {
      token,
      body: {
        topic: "Testing",
        targetLevel: "beginner",
        estimatedDuration: "2 weeks",
      },
    });

    const response = await syllabusPost(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(500);
    expect(data.error).toBe("Something went wrong. Please try again later.");
    expect(data.error).not.toContain("MongoServerError");
    expect(data.error).not.toContain("connection pool");
  });

  it("POST /api/courses/youtube/generate returns generic 500 when an unexpected error occurs", async () => {
    const { token } = await createTestUser({ role: "user" });

    const { enqueueJob } = jest.requireMock("@/lib/queue") as { enqueueJob: jest.Mock };
    const { resolveProvider } = jest.requireMock("@/lib/ai/utils/providerResolver") as { resolveProvider: jest.Mock };

    resolveProvider.mockReturnValueOnce({
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4",
      displayName: "GPT-4",
      providerDisplayName: "OpenAI",
    });

    enqueueJob.mockRejectedValueOnce(
      new Error("Sensitive internal error: API rate limit from upstream")
    );

    const request = buildRequest("POST", "/api/courses/youtube/generate", {
      token,
      body: {
        topic: "JavaScript basics",
        skillLevel: "complete_beginner",
      },
    });

    const response = await youtubePost(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(500);
    expect(data.error).toBe("Something went wrong. Please try again later.");
    expect(data.error).not.toContain("Sensitive");
    expect(data.error).not.toContain("upstream");
  });
});
