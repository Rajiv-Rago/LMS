import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import {
  createTestUser,
  createTestCourse,
  createTestModule,
} from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import Lesson from "@/lib/models/Lesson";
import Course from "@/lib/models/Course";

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

jest.mock("@/lib/ai/utils/userPreferences", () => ({
  getUserAIPreferences: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/logger", () => ({
  captureException: jest.fn(),
}));

import { POST as generatePOST } from "@/app/api/courses/ai/[courseId]/lessons/[lessonId]/generate/route";
import { GET as lessonGET } from "@/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/route";
import { enforceAIRateLimit } from "@/lib/ai/rateLimit";
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

async function createLessonFixture(ownerId: string) {
  const { course } = await createTestCourse(ownerId, {
    owner: ownerId,
  });
  course.syllabusStatus = "completed";
  await course.save();

  const { module } = await createTestModule(course._id);

  const lesson = await Lesson.create({
    title: "Test Lesson",
    module: module._id,
    contentType: "text",
    content: "Original content",
    order: 0,
    isPublished: true,
    generationStatus: "completed",
    keyTakeaways: ["takeaway 1"],
  });

  return { course, module, lesson };
}

describe("POST /api/courses/ai/[courseId]/lessons/[lessonId]/generate", () => {
  it("returns 202 for course owner", async () => {
    const { user, token } = await createTestUser({ role: "teacher" });
    const { course, lesson } = await createLessonFixture(
      user._id.toString()
    );

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/lessons/${lesson._id}/generate`,
      { token, body: {} }
    );
    const response = await generatePOST(request, {
      params: Promise.resolve({
        courseId: course._id.toString(),
        lessonId: lesson._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{ jobId: string }>(response);

    expect(status).toBe(202);
    expect(data.jobId).toBe("mock-job-id-123");
  });

  it("returns 202 for sharedWith user", async () => {
    const { user: owner } = await createTestUser({ role: "teacher" });
    const { user: sharedUser, token: sharedToken } = await createTestUser({
      role: "student",
    });
    const { course, lesson } = await createLessonFixture(
      owner._id.toString()
    );

    await Course.findByIdAndUpdate(course._id, {
      $push: { sharedWith: sharedUser._id },
    });

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/lessons/${lesson._id}/generate`,
      { token: sharedToken, body: {} }
    );
    const response = await generatePOST(request, {
      params: Promise.resolve({
        courseId: course._id.toString(),
        lessonId: lesson._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{ jobId: string }>(response);

    expect(status).toBe(202);
    expect(data.jobId).toBe("mock-job-id-123");
  });

  it("returns 403 for enrolled-only user", async () => {
    const { user: owner } = await createTestUser({ role: "teacher" });
    const { token: studentToken } = await createTestUser({
      role: "student",
    });
    const { course, lesson } = await createLessonFixture(
      owner._id.toString()
    );

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/lessons/${lesson._id}/generate`,
      { token: studentToken, body: {} }
    );
    const response = await generatePOST(request, {
      params: Promise.resolve({
        courseId: course._id.toString(),
        lessonId: lesson._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("returns 401 for unauthenticated user", async () => {
    const { user: owner } = await createTestUser({ role: "teacher" });
    const { course, lesson } = await createLessonFixture(
      owner._id.toString()
    );

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/lessons/${lesson._id}/generate`,
      { body: {} }
    );
    const response = await generatePOST(request, {
      params: Promise.resolve({
        courseId: course._id.toString(),
        lessonId: lesson._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limit exhausted", async () => {
    (enforceAIRateLimit as jest.Mock).mockResolvedValueOnce({
      blocked: true,
      response: NextResponse.json(
        { error: "Daily AI rate limit exceeded." },
        { status: 429 }
      ),
    });

    const { user, token } = await createTestUser({ role: "teacher" });
    const { course, lesson } = await createLessonFixture(
      user._id.toString()
    );

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/lessons/${lesson._id}/generate`,
      { token, body: {} }
    );
    const response = await generatePOST(request, {
      params: Promise.resolve({
        courseId: course._id.toString(),
        lessonId: lesson._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(429);
    expect(data.error).toMatch(/rate limit/i);
  });
});

describe("GET /api/courses/[id]/modules/[moduleId]/lessons/[lessonId]", () => {
  it("returns isSharedWith in permissions for shared user", async () => {
    const { user: owner } = await createTestUser({ role: "teacher" });
    const { user: sharedUser, token: sharedToken } = await createTestUser({
      role: "student",
    });
    const { course, module, lesson } = await createLessonFixture(
      owner._id.toString()
    );

    await Course.findByIdAndUpdate(course._id, {
      $push: { sharedWith: sharedUser._id },
    });

    const request = buildRequest(
      "GET",
      `/api/courses/${course._id}/modules/${module._id}/lessons/${lesson._id}`,
      { token: sharedToken }
    );
    const response = await lessonGET(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        moduleId: module._id.toString(),
        lessonId: lesson._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      lesson: Record<string, unknown>;
      permissions: { canEdit: boolean; isSharedWith: boolean };
    }>(response);

    expect(status).toBe(200);
    expect(data.permissions.isSharedWith).toBe(true);
    expect(data.permissions.canEdit).toBe(false);
  });
});
