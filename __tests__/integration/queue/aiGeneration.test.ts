import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser } from "../../helpers/fixtures";
import { Course, Module, Lesson } from "@/lib/models";
import type { JobHandler } from "@/lib/queue/handlers";

// --- Mocks ---

jest.mock("@/lib/ai/services/syllabusGenerator");
jest.mock("@/lib/ai/services/lessonContentGenerator");
jest.mock("@/lib/ai/utils/providerResolver");
jest.mock("@/lib/ai/utils/userPreferences");
jest.mock("@/lib/ai/utils/promptUtils");
jest.mock("@/lib/utils/aiGenerationLogger");
jest.mock("@/lib/utils/moduleStatusUpdater");
jest.mock("@/lib/notifications");
jest.mock("@/lib/logger");
jest.mock("@youtube-core/youtubeSearch");

// Must mock env BEFORE handler import reads it at module level
jest.mock("@/lib/env", () => ({
  env: {
    YOUTUBE_API_KEY: "test-youtube-key",
    MONGODB_URI: "test",
    JWT_SECRET: "a]32charminimumtestsecretkey!!!!!",
  },
}));

import { SyllabusGeneratorService } from "@/lib/ai/services/syllabusGenerator";
import { LessonContentGeneratorService } from "@/lib/ai/services/lessonContentGenerator";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { getUserAIPreferences } from "@/lib/ai/utils/userPreferences";
import { extractTargetLevel } from "@/lib/ai/utils/promptUtils";
import { logAIGeneration } from "@/lib/utils/aiGenerationLogger";
import {
  recalculateModuleStatus,
  markModuleCompletedIfReady,
} from "@/lib/utils/moduleStatusUpdater";
import { sendNotification } from "@/lib/notifications";
import { searchYouTubeVideos, filterAndDedup } from "@youtube-core/youtubeSearch";

const mockResolveProvider = resolveProvider as jest.MockedFunction<typeof resolveProvider>;
const mockGetUserAIPreferences = getUserAIPreferences as jest.MockedFunction<typeof getUserAIPreferences>;
const mockExtractTargetLevel = extractTargetLevel as jest.MockedFunction<typeof extractTargetLevel>;
const mockLogAIGeneration = logAIGeneration as jest.MockedFunction<typeof logAIGeneration>;
const mockRecalculateModuleStatus = recalculateModuleStatus as jest.MockedFunction<typeof recalculateModuleStatus>;
const mockMarkModuleCompletedIfReady = markModuleCompletedIfReady as jest.MockedFunction<typeof markModuleCompletedIfReady>;
const mockSendNotification = sendNotification as jest.MockedFunction<typeof sendNotification>;
const mockSearchYouTubeVideos = searchYouTubeVideos as jest.MockedFunction<typeof searchYouTubeVideos>;
const mockFilterAndDedup = filterAndDedup as jest.MockedFunction<typeof filterAndDedup>;

// Syllabus mock
const mockGenerateSyllabus = jest.fn();
(SyllabusGeneratorService as jest.MockedClass<typeof SyllabusGeneratorService>).prototype.generateSyllabus = mockGenerateSyllabus;

// Lesson content mock
const mockGenerateLessonContent = jest.fn();
(LessonContentGeneratorService as jest.MockedClass<typeof LessonContentGeneratorService>).prototype.generateLessonContent = mockGenerateLessonContent;

// --- Test data ---

function makeSyllabus(includeVideos = false) {
  return {
    courseTitle: "TypeScript Fundamentals",
    courseDescription: "Learn TypeScript from scratch",
    modules: [
      {
        title: "Module 1: Basics",
        description: "TypeScript basics",
        order: 0,
        lessons: [
          { title: "Lesson 1.1: Types", outline: "Basic types", order: 0, contentType: "text" as const },
          includeVideos
            ? { title: "Lesson 1.2: Setup", outline: "Setup guide", order: 1, contentType: "video" as const, videoSearchQuery: "typescript setup tutorial" }
            : { title: "Lesson 1.2: Variables", outline: "Variables", order: 1, contentType: "text" as const },
        ],
      },
      {
        title: "Module 2: Advanced",
        description: "Advanced TypeScript",
        order: 1,
        lessons: [
          { title: "Lesson 2.1: Generics", outline: "Generics intro", order: 0, contentType: "text" as const },
          includeVideos
            ? { title: "Lesson 2.2: Patterns", outline: "Design patterns", order: 1, contentType: "video" as const, videoSearchQuery: "typescript design patterns" }
            : { title: "Lesson 2.2: Interfaces", outline: "Interfaces", order: 1, contentType: "text" as const },
        ],
      },
    ],
  };
}

const youtubeResult = {
  videoId: "yt123",
  channelName: "TestChannel",
  channelId: "ch1",
  thumbnailUrl: "http://thumb.jpg",
  viewCount: 1000,
  publishedAt: "2025-01-01",
  duration: "PT10M",
  title: "Test Video",
};

// --- Test suite ---

let syllabusHandler: JobHandler;
let moduleContentHandler: JobHandler;
let lessonContentHandler: JobHandler;
let testUserId: string;

beforeAll(async () => {
  await connectTestDb();
  const { getHandler, handlersReady } = await import("@/lib/queue/handlers");
  await handlersReady;
  syllabusHandler = getHandler("ai.generate-syllabus")!;
  moduleContentHandler = getHandler("ai.generate-module-content")!;
  lessonContentHandler = getHandler("ai.generate-lesson-content")!;
});

beforeEach(async () => {
  await clearTestDb();
  jest.clearAllMocks();

  const { user } = await createTestUser({ role: "admin" });
  testUserId = user._id.toString();

  // Default mock returns
  mockResolveProvider.mockReturnValue({
    provider: "openai" as const,
    apiKey: "test-key",
    model: "gpt-4",
    providerDisplayName: "OpenAI",
  });

  mockGetUserAIPreferences.mockResolvedValue(undefined);
  mockExtractTargetLevel.mockReturnValue("beginner");
  mockLogAIGeneration.mockResolvedValue(undefined);
  mockRecalculateModuleStatus.mockResolvedValue("completed");
  mockMarkModuleCompletedIfReady.mockResolvedValue(true);
  mockSendNotification.mockResolvedValue(undefined);

  mockGenerateSyllabus.mockResolvedValue({
    syllabus: makeSyllabus(false),
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
  });

  mockSearchYouTubeVideos.mockResolvedValue([youtubeResult]);
  mockFilterAndDedup.mockImplementation((input: unknown) => input as typeof youtubeResult[]);

  mockGenerateLessonContent.mockResolvedValue({
    content: { content: "Generated lesson content...", keyTakeaways: ["Key point 1", "Key point 2"] },
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
  });
});

afterAll(async () => {
  await disconnectTestDb();
});

// ──────── ai.generate-syllabus ────────

describe("ai.generate-syllabus handler", () => {
  it("creates course with modules and lessons", async () => {
    const result = await syllabusHandler({
      topic: "TypeScript",
      targetLevel: "beginner",
      estimatedDuration: "4 weeks",
      userId: testUserId,
    });

    expect(result.courseId).toBeDefined();

    const course = await Course.findById(result.courseId);
    expect(course).not.toBeNull();
    expect(course!.title).toBe("TypeScript Fundamentals");
    expect(course!.owner!.toString()).toBe(testUserId);
    expect(course!.syllabusStatus).toBe("completed");

    const modules = await Module.find({ course: course!._id }).sort({ order: 1 });
    expect(modules).toHaveLength(2);
    expect(modules[0].title).toBe("Module 1: Basics");
    expect(modules[1].title).toBe("Module 2: Advanced");

    const allLessons = await Lesson.find({
      module: { $in: modules.map((m) => m._id) },
    });
    expect(allLessons).toHaveLength(4);
  });

  it("fills video lessons with YouTube data when includeVideos is true", async () => {
    mockGenerateSyllabus.mockResolvedValue({
      syllabus: makeSyllabus(true),
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    });

    const result = await syllabusHandler({
      topic: "TypeScript",
      targetLevel: "beginner",
      estimatedDuration: "4 weeks",
      includeVideos: true,
      userId: testUserId,
    });

    const course = await Course.findById(result.courseId);
    const modules = await Module.find({ course: course!._id });
    const videoLessons = await Lesson.find({
      module: { $in: modules.map((m) => m._id) },
      contentType: "video",
    });

    expect(videoLessons.length).toBeGreaterThan(0);
    for (const lesson of videoLessons) {
      expect(lesson.youtubeMetadata?.videoId).toBe("yt123");
      expect(lesson.videoUrl).toContain("yt123");
      expect(lesson.generationStatus).toBe("completed");
    }
  });

  it("falls back video to text when no YouTube results", async () => {
    mockGenerateSyllabus.mockResolvedValue({
      syllabus: makeSyllabus(true),
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    });
    mockFilterAndDedup.mockReturnValue([]);

    const result = await syllabusHandler({
      topic: "TypeScript",
      targetLevel: "beginner",
      estimatedDuration: "4 weeks",
      includeVideos: true,
      userId: testUserId,
    });

    const course = await Course.findById(result.courseId);
    const modules = await Module.find({ course: course!._id });

    // Video lessons should have fallen back to text
    const lessons = await Lesson.find({
      module: { $in: modules.map((m) => m._id) },
    });

    const originalVideoLessons = lessons.filter((l) =>
      l.title === "Lesson 1.2: Setup" || l.title === "Lesson 2.2: Patterns"
    );

    for (const lesson of originalVideoLessons) {
      expect(lesson.contentType).toBe("text");
      expect(lesson.generationStatus).toBe("skeleton");
    }
  });

  it("handles YouTube search error gracefully", async () => {
    mockGenerateSyllabus.mockResolvedValue({
      syllabus: makeSyllabus(true),
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    });
    mockSearchYouTubeVideos.mockRejectedValue(new Error("YouTube API error"));

    const result = await syllabusHandler({
      topic: "TypeScript",
      targetLevel: "beginner",
      estimatedDuration: "4 weeks",
      includeVideos: true,
      userId: testUserId,
    });

    expect(result.courseId).toBeDefined();

    const course = await Course.findById(result.courseId);
    const modules = await Module.find({ course: course!._id });
    const lessons = await Lesson.find({
      module: { $in: modules.map((m) => m._id) },
    });

    const originalVideoLessons = lessons.filter((l) =>
      l.title === "Lesson 1.2: Setup" || l.title === "Lesson 2.2: Patterns"
    );

    for (const lesson of originalVideoLessons) {
      expect(lesson.contentType).toBe("text");
      expect(lesson.generationStatus).toBe("skeleton");
    }
  });

  it("throws when provider resolution fails", async () => {
    mockResolveProvider.mockReturnValue(null);

    await expect(
      syllabusHandler({
        topic: "TypeScript",
        targetLevel: "beginner",
        estimatedDuration: "4 weeks",
        userId: testUserId,
      })
    ).rejects.toThrow("AI service is temporarily unavailable");
  });

  it("sends notification on completion", async () => {
    await syllabusHandler({
      topic: "TypeScript",
      targetLevel: "beginner",
      estimatedDuration: "4 weeks",
      userId: testUserId,
    });

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: testUserId,
        type: "ai.generation.completed",
        title: "Course generated",
      })
    );
  });

  it("logs AI generation", async () => {
    await syllabusHandler({
      topic: "TypeScript",
      targetLevel: "beginner",
      estimatedDuration: "4 weeks",
      userId: testUserId,
    });

    expect(mockLogAIGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        user: testUserId,
        generationType: "syllabus",
        provider: "openai",
        status: "completed",
      })
    );
  });
});

// ──────── ai.generate-module-content ────────

describe("ai.generate-module-content handler", () => {
  let courseId: string;
  let moduleId: string;

  beforeEach(async () => {
    const course = await Course.create({
      title: "Test Course",
      description: "A test course",
      instructor: testUserId,
      owner: testUserId,
      syllabusStatus: "completed",
      syllabusPrompt: "Topic: TypeScript\nLevel: beginner\nDuration: 4 weeks",
      isPublished: true,
    });
    courseId = course._id.toString();

    const mod = await Module.create({
      title: "Test Module",
      description: "A test module",
      course: course._id,
      order: 0,
      contentStatus: "skeleton",
      isPublished: true,
    });
    moduleId = mod._id.toString();

    for (let i = 0; i < 3; i++) {
      const lesson = await Lesson.create({
        title: `Lesson ${i + 1}`,
        module: mod._id,
        contentType: "text",
        content: "",
        order: i,
        generationStatus: "skeleton",
        lessonOutline: `Outline for lesson ${i + 1}`,
        isPublished: true,
      });
      mod.lessons = [...(mod.lessons || []), lesson._id];
    }
    await mod.save();
  });

  it("generates content for all lessons in module", async () => {
    const result = await moduleContentHandler({
      courseId,
      moduleId,
      userId: testUserId,
    });

    expect(result.totalLessons).toBe(3);
    expect(result.failedLessons).toBe(0);
    expect(result.moduleId).toBe(moduleId);
    expect(result.durationMs).toBeDefined();

    const lessons = await Lesson.find({ module: moduleId }).sort({ order: 1 });
    for (const lesson of lessons) {
      expect(lesson.generationStatus).toBe("completed");
      expect(lesson.content).toBe("Generated lesson content...");
      expect(lesson.keyTakeaways).toEqual(["Key point 1", "Key point 2"]);
    }
  });

  it("marks individual lessons failed without aborting", async () => {
    mockGenerateLessonContent
      .mockResolvedValueOnce({
        content: { content: "Content 1", keyTakeaways: ["KT1"] },
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      })
      .mockRejectedValueOnce(new Error("Generation failed"))
      .mockResolvedValueOnce({
        content: { content: "Content 3", keyTakeaways: ["KT3"] },
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      });

    const result = await moduleContentHandler({
      courseId,
      moduleId,
      userId: testUserId,
    });

    expect(result.failedLessons).toBe(1);

    const lessons = await Lesson.find({ module: moduleId }).sort({ order: 1 });
    expect(lessons[0].generationStatus).toBe("completed");
    expect(lessons[1].generationStatus).toBe("failed");
    expect(lessons[2].generationStatus).toBe("completed");
  });

  it("throws Course not found for wrong owner", async () => {
    const otherId = new mongoose.Types.ObjectId().toString();

    await expect(
      moduleContentHandler({
        courseId,
        moduleId,
        userId: otherId,
      })
    ).rejects.toThrow("Course not found");
  });

  it("throws Module not found for invalid module", async () => {
    const fakeModuleId = new mongoose.Types.ObjectId().toString();

    await expect(
      moduleContentHandler({
        courseId,
        moduleId: fakeModuleId,
        userId: testUserId,
      })
    ).rejects.toThrow("Module not found");
  });

  it("throws when provider resolution fails", async () => {
    mockResolveProvider.mockReturnValue(null);

    await expect(
      moduleContentHandler({
        courseId,
        moduleId,
        userId: testUserId,
      })
    ).rejects.toThrow("AI service is temporarily unavailable");
  });

  it("calls recalculateModuleStatus in finally block", async () => {
    await moduleContentHandler({
      courseId,
      moduleId,
      userId: testUserId,
    });

    expect(mockRecalculateModuleStatus).toHaveBeenCalledWith(moduleId);
  });

  it("calls recalculateModuleStatus even on failure", async () => {
    mockGenerateLessonContent.mockRejectedValue(new Error("All fail"));

    await moduleContentHandler({
      courseId,
      moduleId,
      userId: testUserId,
    });

    expect(mockRecalculateModuleStatus).toHaveBeenCalledWith(moduleId);
  });

  it("sends notification on completion", async () => {
    await moduleContentHandler({
      courseId,
      moduleId,
      userId: testUserId,
    });

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: testUserId,
        type: "ai.generation.completed",
      })
    );
  });
});

// ──────── ai.generate-lesson-content ────────

describe("ai.generate-lesson-content handler", () => {
  let courseId: string;
  let moduleId: string;
  let thirdLessonId: string;

  beforeEach(async () => {
    const course = await Course.create({
      title: "Test Course",
      description: "A test course",
      instructor: testUserId,
      owner: testUserId,
      syllabusStatus: "completed",
      syllabusPrompt: "Topic: TypeScript\nLevel: beginner\nDuration: 4 weeks",
      isPublished: true,
    });
    courseId = course._id.toString();

    const mod = await Module.create({
      title: "Test Module",
      description: "A test module",
      course: course._id,
      order: 0,
      contentStatus: "skeleton",
      isPublished: true,
    });
    moduleId = mod._id.toString();

    // First two lessons completed with keyTakeaways
    await Lesson.create({
      title: "Lesson 1",
      module: mod._id,
      contentType: "text",
      content: "Lesson 1 content",
      order: 0,
      generationStatus: "completed",
      keyTakeaways: ["Takeaway 1A", "Takeaway 1B"],
      isPublished: true,
    });

    await Lesson.create({
      title: "Lesson 2",
      module: mod._id,
      contentType: "text",
      content: "Lesson 2 content",
      order: 1,
      generationStatus: "completed",
      keyTakeaways: ["Takeaway 2A"],
      isPublished: true,
    });

    // Third lesson as skeleton
    const third = await Lesson.create({
      title: "Lesson 3",
      module: mod._id,
      contentType: "text",
      content: "",
      order: 2,
      generationStatus: "skeleton",
      lessonOutline: "Third lesson outline",
      isPublished: true,
    });
    thirdLessonId = third._id.toString();
  });

  it("generates content for single lesson", async () => {
    const result = await lessonContentHandler({
      courseId,
      lessonId: thirdLessonId,
      userId: testUserId,
    });

    expect(result.lessonId).toBe(thirdLessonId);
    expect(result.durationMs).toBeDefined();

    const lesson = await Lesson.findById(thirdLessonId);
    expect(lesson!.generationStatus).toBe("completed");
    expect(lesson!.content).toBe("Generated lesson content...");
    expect(lesson!.keyTakeaways).toEqual(["Key point 1", "Key point 2"]);
  });

  it("includes previous lessons summary as context", async () => {
    await lessonContentHandler({
      courseId,
      lessonId: thirdLessonId,
      userId: testUserId,
    });

    expect(mockGenerateLessonContent).toHaveBeenCalledWith(
      expect.objectContaining({
        previousLessonsSummary: expect.stringContaining("Takeaway 1A"),
      })
    );

    expect(mockGenerateLessonContent).toHaveBeenCalledWith(
      expect.objectContaining({
        previousLessonsSummary: expect.stringContaining("Takeaway 2A"),
      })
    );
  });

  it("passes feedback for regeneration", async () => {
    // Give the third lesson existing content (simulating regeneration)
    await Lesson.findByIdAndUpdate(thirdLessonId, {
      content: "Previous content",
      generationStatus: "completed",
    });

    await lessonContentHandler({
      courseId,
      lessonId: thirdLessonId,
      feedback: "Make it simpler",
      userId: testUserId,
    });

    expect(mockGenerateLessonContent).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: "Make it simpler",
        previousContent: "Previous content",
      })
    );
  });

  it("marks lesson failed and re-throws on error", async () => {
    mockGenerateLessonContent.mockRejectedValue(new Error("AI generation failed"));

    await expect(
      lessonContentHandler({
        courseId,
        lessonId: thirdLessonId,
        userId: testUserId,
      })
    ).rejects.toThrow("AI generation failed");

    const lesson = await Lesson.findById(thirdLessonId);
    expect(lesson!.generationStatus).toBe("failed");
  });

  it("throws Course not found for wrong owner", async () => {
    const otherId = new mongoose.Types.ObjectId().toString();

    await expect(
      lessonContentHandler({
        courseId,
        lessonId: thirdLessonId,
        userId: otherId,
      })
    ).rejects.toThrow("Course not found");
  });

  it("throws Lesson not found for invalid lesson", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      lessonContentHandler({
        courseId,
        lessonId: fakeId,
        userId: testUserId,
      })
    ).rejects.toThrow("Lesson not found");
  });

  it("throws Module not found when module is missing", async () => {
    // Create a lesson that belongs to a non-existent module
    const orphanLesson = await Lesson.create({
      title: "Orphan",
      module: new mongoose.Types.ObjectId(),
      contentType: "text",
      content: "",
      order: 0,
      generationStatus: "skeleton",
      isPublished: true,
    });

    await expect(
      lessonContentHandler({
        courseId,
        lessonId: orphanLesson._id.toString(),
        userId: testUserId,
      })
    ).rejects.toThrow("Module not found");
  });

  it("calls markModuleCompletedIfReady on success", async () => {
    await lessonContentHandler({
      courseId,
      lessonId: thirdLessonId,
      userId: testUserId,
    });

    expect(mockMarkModuleCompletedIfReady).toHaveBeenCalledWith(moduleId);
  });
});
