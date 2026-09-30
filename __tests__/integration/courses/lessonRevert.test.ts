import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import {
  createTestUser,
  createTestCourse,
  createTestModule,
} from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import Lesson from "@/lib/models/Lesson";
import Course from "@/lib/models/Course";

jest.mock("@/lib/logger", () => ({
  captureException: jest.fn(),
}));

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

async function createLessonWithPreviousContent(ownerId: string) {
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
    content: "New content after regeneration",
    previousContent: "Original content before regeneration",
    keyTakeaways: ["new takeaway"],
    previousKeyTakeaways: ["old takeaway"],
    sources: [{ title: "New citation", url: "https://example.com/new" }],
    previousSources: [{ title: "Old citation", url: "https://example.com/old" }],
    learningResources: [{ title: "New resource", url: "https://example.com/new", description: "New", type: "tutorial", requiresSignup: false }],
    previousLearningResources: [{ title: "Old resource", url: "https://example.com/old", description: "Old", type: "exercise", requiresSignup: true }],
    order: 0,
    isPublished: true,
    generationStatus: "completed",
  });

  return { course, module, lesson };
}

async function createLessonWithoutPreviousContent(ownerId: string) {
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
    content: "Some content",
    order: 0,
    isPublished: true,
    generationStatus: "completed",
  });

  return { course, module, lesson };
}

describe("POST /api/courses/ai/[courseId]/lessons/[lessonId]/revert", () => {
  let revertPOST: typeof import("@/app/api/courses/ai/[courseId]/lessons/[lessonId]/revert/route").POST;

  beforeAll(async () => {
    const mod = await import(
      "@/app/api/courses/ai/[courseId]/lessons/[lessonId]/revert/route"
    );
    revertPOST = mod.POST;
  });

  it("swaps content and previousContent for owner", async () => {
    const { user, token } = await createTestUser({ role: "user" });
    const { course, lesson } = await createLessonWithPreviousContent(
      user._id.toString()
    );

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/lessons/${lesson._id}/revert`,
      { token }
    );
    const response = await revertPOST(request, {
      params: Promise.resolve({
        courseId: course._id.toString(),
        lessonId: lesson._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      lesson: {
        content: string;
        previousContent?: string;
        keyTakeaways: string[];
        previousKeyTakeaways?: string[];
        sources: { title: string }[];
        learningResources: { title: string; requiresSignup: boolean }[];
      };
    }>(response);

    expect(status).toBe(200);
    expect(data.lesson.content).toBe("Original content before regeneration");
    expect(data.lesson.keyTakeaways).toEqual(["old takeaway"]);
    expect(data.lesson.previousContent).toBeUndefined();
    expect(data.lesson.previousKeyTakeaways).toBeUndefined();
    expect(data.lesson.sources[0].title).toBe("Old citation");
    expect(data.lesson.learningResources[0]).toMatchObject({ title: "Old resource", requiresSignup: true });
  });

  it("rejects a lesson from another course even when the user owns both", async () => {
    const { user, token } = await createTestUser();
    const first = await createLessonWithPreviousContent(user._id.toString());
    const second = await createLessonWithPreviousContent(user._id.toString());
    const response = await revertPOST(buildRequest("POST", "/api/revert", { token }), {
      params: Promise.resolve({ courseId: first.course._id.toString(), lessonId: second.lesson._id.toString() }),
    });
    expect(response.status).toBe(404);
    expect((await Lesson.findById(second.lesson._id))?.content).toBe("New content after regeneration");
  });

  it("swaps content for sharedWith user", async () => {
    const { user: owner } = await createTestUser({ role: "user" });
    const { user: sharedUser, token: sharedToken } = await createTestUser({
      role: "user",
    });
    const { course, lesson } = await createLessonWithPreviousContent(
      owner._id.toString()
    );

    await Course.findByIdAndUpdate(course._id, {
      $push: { sharedWith: sharedUser._id },
    });

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/lessons/${lesson._id}/revert`,
      { token: sharedToken }
    );
    const response = await revertPOST(request, {
      params: Promise.resolve({
        courseId: course._id.toString(),
        lessonId: lesson._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      lesson: { content: string };
    }>(response);

    expect(status).toBe(200);
    expect(data.lesson.content).toBe("Original content before regeneration");
  });

  it("returns 403 for enrolled-only user", async () => {
    const { user: owner } = await createTestUser({ role: "user" });
    const { token: studentToken } = await createTestUser({
      role: "user",
    });
    const { course, lesson } = await createLessonWithPreviousContent(
      owner._id.toString()
    );

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/lessons/${lesson._id}/revert`,
      { token: studentToken }
    );
    const response = await revertPOST(request, {
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
    const { user: owner } = await createTestUser({ role: "user" });
    const { course, lesson } = await createLessonWithPreviousContent(
      owner._id.toString()
    );

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/lessons/${lesson._id}/revert`,
      {}
    );
    const response = await revertPOST(request, {
      params: Promise.resolve({
        courseId: course._id.toString(),
        lessonId: lesson._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 when lesson has no previousContent", async () => {
    const { user, token } = await createTestUser({ role: "user" });
    const { course, lesson } = await createLessonWithoutPreviousContent(
      user._id.toString()
    );

    const request = buildRequest(
      "POST",
      `/api/courses/ai/${course._id}/lessons/${lesson._id}/revert`,
      { token }
    );
    const response = await revertPOST(request, {
      params: Promise.resolve({
        courseId: course._id.toString(),
        lessonId: lesson._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(404);
    expect(data.error).toBe("No previous version available");
  });
});

describe("GET /api/ai/credits", () => {
  let creditsGET: typeof import("@/app/api/ai/credits/route").GET;

  beforeAll(async () => {
    const mod = await import("@/app/api/ai/credits/route");
    creditsGET = mod.GET;
  });

  it("returns remaining credits for authenticated user", async () => {
    const { token } = await createTestUser({ role: "user" });

    const request = buildRequest("GET", "/api/ai/credits", { token });
    const response = await creditsGET(request);
    const { status, data } = await parseResponse<{
      remaining: number;
      limit: number;
      resetAt: string;
    }>(response);

    expect(status).toBe(200);
    expect(typeof data.remaining).toBe("number");
    expect(typeof data.limit).toBe("number");
    expect(typeof data.resetAt).toBe("string");
  });

  it("returns 401 for unauthenticated user", async () => {
    const request = buildRequest("GET", "/api/ai/credits");
    const response = await creditsGET(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns Infinity remaining for admin user", async () => {
    const { token } = await createTestUser({ role: "admin" });

    const request = buildRequest("GET", "/api/ai/credits", { token });
    const response = await creditsGET(request);
    const { status, data } = await parseResponse<{
      remaining: number;
      limit: number;
    }>(response);

    expect(status).toBe(200);
    expect(data.remaining).toBe(null);
    expect(data.limit).toBe(null);
  });
});
