import { dbConnect } from "@/lib/db";
import { Course, Module, Lesson } from "@/lib/models";
import { AIProviderName, AITier } from "@/lib/ai/types";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { getUserAIPreferences } from "@/lib/ai/utils/userPreferences";
import {
  SyllabusGeneratorService,
  TargetLevel,
} from "@/lib/ai/services/syllabusGenerator";
import { LessonContentGeneratorService } from "@/lib/ai/services/lessonContentGenerator";
import { extractTargetLevel } from "@/lib/ai/utils/promptUtils";
import { logAIGeneration } from "@/lib/utils/aiGenerationLogger";
import { recalculateModuleStatus } from "@/lib/utils/moduleStatusUpdater";
import { markModuleCompletedIfReady } from "@/lib/utils/moduleStatusUpdater";
import { sendNotification } from "@/lib/notifications";
import { captureException } from "@/lib/logger";
import { env } from "@/lib/env";
import {
  searchYouTubeVideos,
  filterAndDedup,
} from "@youtube-core/youtubeSearch";
import { registerHandler } from "./index";

const MAX_SUMMARY_LENGTH = 2000;

// ──────── ai.generate-syllabus ────────
registerHandler(
  "ai.generate-syllabus",
  async (data: Record<string, unknown>) => {
    const startTime = Date.now();
    const {
      topic,
      targetLevel,
      estimatedDuration,
      additionalContext,
      includeVideos,
      tier,
      provider,
      model,
      userId,
    } = data as {
      topic: string;
      targetLevel: string;
      estimatedDuration: string;
      additionalContext?: string;
      includeVideos?: boolean;
      tier?: string;
      provider?: string;
      model?: string;
      userId: string;
    };

    const userPreferences =
      tier || provider
        ? undefined
        : await getUserAIPreferences(userId);

    const resolved = resolveProvider({
      requestProvider: provider as AIProviderName,
      requestModel: model,
      requestTier: tier as AITier,
      userPreferences,
    });

    if (!resolved) {
      captureException(new Error(`Provider not configured: ${provider || process.env.AI_PROVIDER || "openai"}`), {
        operation: "resolve-provider",
        jobType: "ai.generate-syllabus",
      });
      throw new Error("AI service is temporarily unavailable");
    }

    await dbConnect();

    const syllabusService = new SyllabusGeneratorService({
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      model: resolved.model,
    });

    const { syllabus, usage } = await syllabusService.generateSyllabus({
      topic,
      targetLevel: targetLevel as TargetLevel,
      estimatedDuration,
      additionalContext,
      includeVideos,
    });

    const course = await Course.create({
      title: syllabus.courseTitle,
      description: syllabus.courseDescription,
      instructor: userId,
      owner: userId,
      syllabusStatus: "completed",
      syllabusPrompt: `Topic: ${topic}\nLevel: ${targetLevel}\nDuration: ${estimatedDuration}${additionalContext ? `\nContext: ${additionalContext}` : ""}`,
      aiPreferences: {
        defaultProvider: resolved.provider,
        defaultModel: resolved.model,
      },
      isPublished: true,
    });

    const modulePromises = syllabus.modules.map(
      async (moduleData, moduleIndex) => {
        const courseModule = await Module.create({
          title: moduleData.title,
          description: moduleData.description,
          course: course._id,
          order: moduleData.order ?? moduleIndex,
          contentStatus: "skeleton",
          isPublished: true,
        });

        const lessonPromises = moduleData.lessons.map(
          async (lessonData, lessonIndex) => {
            const isVideoLesson =
              includeVideos &&
              lessonData.contentType === "video" &&
              lessonData.videoSearchQuery;

            return Lesson.create({
              title: lessonData.title,
              module: courseModule._id,
              contentType: isVideoLesson ? "video" : "text",
              content: "",
              order: lessonData.order ?? lessonIndex,
              generationStatus: "skeleton",
              lessonOutline: isVideoLesson
                ? lessonData.videoSearchQuery
                : lessonData.outline,
              isPublished: true,
            });
          }
        );

        const lessons = await Promise.all(lessonPromises);
        courseModule.lessons = lessons.map((l) => l._id);
        await courseModule.save();
        return courseModule;
      }
    );

    const modules = await Promise.all(modulePromises);
    course.modules = modules.map((m) => m._id);
    await course.save();

    // Fill video lessons with YouTube data if applicable
    if (includeVideos && env.YOUTUBE_API_KEY) {
      const videoLessons = await Lesson.find({
        module: { $in: modules.map((m) => m._id) },
        contentType: "video",
        generationStatus: "skeleton",
      });

      const fillVideoLesson = async (lesson: InstanceType<typeof Lesson>) => {
        try {
          const query = lesson.lessonOutline || lesson.title;
          const rawResults = await searchYouTubeVideos(env.YOUTUBE_API_KEY!, {
            topic: query,
            maxResults: 5,
          });

          const filtered = filterAndDedup(rawResults);

          if (filtered.length === 0) {
            lesson.contentType = "text";
            lesson.generationStatus = "skeleton";
            await lesson.save();
            return;
          }

          const best = filtered[0];
          lesson.videoUrl = `https://www.youtube.com/embed/${best.videoId}`;
          lesson.youtubeMetadata = {
            videoId: best.videoId,
            channelName: best.channelName,
            channelId: best.channelId,
            thumbnailUrl: best.thumbnailUrl,
            viewCount: best.viewCount,
            publishedAt: best.publishedAt
              ? new Date(best.publishedAt)
              : undefined,
            videoDuration: best.duration,
          };
          lesson.content = best.title;
          lesson.generationStatus = "completed";
          await lesson.save();
        } catch (videoError) {
          captureException(videoError, {
            operation: `Error fetching YouTube video for lesson ${lesson._id}`,
          });
          lesson.contentType = "text";
          lesson.generationStatus = "skeleton";
          await lesson.save();
        }
      };

      await Promise.allSettled(videoLessons.map(fillVideoLesson));
    }

    await logAIGeneration({
      user: userId,
      course: course._id.toString(),
      generationType: "syllabus",
      provider: resolved.provider,
      model: resolved.model || "default",
      prompt: `Topic: ${topic}\nLevel: ${targetLevel}\nDuration: ${estimatedDuration}${additionalContext ? `\nContext: ${additionalContext}` : ""}`,
      response: JSON.stringify(syllabus),
      tokenUsage: usage,
      status: "completed",
      durationMs: Date.now() - startTime,
    });

    await sendNotification({
      userId,
      type: "ai.generation.completed",
      title: "Course generated",
      message: `Course "${syllabus.courseTitle}" has been generated`,
      link: `/courses/${course._id}`,
    });

    return { courseId: course._id.toString() };
  }
);

// ──────── ai.generate-module-content ────────
registerHandler(
  "ai.generate-module-content",
  async (data: Record<string, unknown>) => {
    const startTime = Date.now();
    const {
      courseId,
      moduleId,
      tier,
      provider,
      model,
      userId,
    } = data as {
      courseId: string;
      moduleId: string;
      tier?: string;
      provider?: string;
      model?: string;
      userId: string;
    };

    await dbConnect();

    const course = await Course.findOne({
      _id: courseId,
      owner: userId,
    });

    if (!course) throw new Error("Course not found");

    const userPreferences =
      tier || provider
        ? undefined
        : await getUserAIPreferences(userId);

    const resolved = resolveProvider({
      requestProvider: provider as AIProviderName,
      requestModel: model,
      requestTier: tier as AITier,
      coursePreferences: course.aiPreferences,
      userPreferences,
    });

    if (!resolved) {
      captureException(new Error(`Provider not configured: ${provider || "default"}`), {
        operation: "resolve-provider",
        jobType: "ai.generate-module-content",
      });
      throw new Error("AI service is temporarily unavailable");
    }

    const courseModule = await Module.findOne({
      _id: moduleId,
      course: courseId,
    }).populate("lessons");

    if (!courseModule) throw new Error("Module not found");

    const lessonService = new LessonContentGeneratorService({
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      model: resolved.model,
    });

    courseModule.contentStatus = "generating";
    courseModule.generationConfig = {
      provider: resolved.provider,
      model: resolved.model,
    };
    await courseModule.save();

    const targetLevel = extractTargetLevel(course.syllabusPrompt);
    const lessons = await Lesson.find({ module: moduleId }).sort({ order: 1 });

    let previousLessonsSummary = "";

    try {
      for (const lesson of lessons) {
        try {
          lesson.generationStatus = "generating";
          lesson.generationConfig = {
            provider: resolved.provider,
            model: resolved.model,
          };
          await lesson.save();

          const lessonStartTime = Date.now();

          let summaryForPrompt = previousLessonsSummary;
          if (summaryForPrompt.length > MAX_SUMMARY_LENGTH) {
            summaryForPrompt = summaryForPrompt.slice(-MAX_SUMMARY_LENGTH);
          }

          const { content, usage } =
            await lessonService.generateLessonContent({
              courseTitle: course.title,
              courseDescription: course.description,
              moduleTitle: courseModule.title,
              lessonTitle: lesson.title,
              lessonOutline: lesson.lessonOutline || "",
              previousLessonsSummary: summaryForPrompt || undefined,
              targetLevel,
              tier: (tier as AITier) || undefined,
            });

          lesson.content = content.content;
          lesson.keyTakeaways = content.keyTakeaways;
          lesson.generationStatus = "completed";
          await lesson.save();

          await logAIGeneration({
            user: userId,
            course: courseId,
            module: moduleId,
            lesson: lesson._id.toString(),
            generationType: "lesson_content",
            provider: resolved.provider,
            model: resolved.model || "default",
            prompt: `Generate content for lesson: ${lesson.title}\nOutline: ${lesson.lessonOutline}`,
            response: content.content.substring(0, 5000),
            tokenUsage: usage,
            status: "completed",
            durationMs: Date.now() - lessonStartTime,
          });

          if (content.keyTakeaways.length > 0) {
            previousLessonsSummary += `\n${lesson.title}: ${content.keyTakeaways.join("; ")}`;
          }
        } catch (lessonError) {
          captureException(lessonError, {
            operation: `Error generating lesson ${lesson._id}`,
          });
          lesson.generationStatus = "failed";
          await lesson.save();

          await logAIGeneration({
            user: userId,
            course: courseId,
            module: moduleId,
            lesson: lesson._id.toString(),
            generationType: "lesson_content",
            provider: resolved.provider,
            model: resolved.model || "default",
            prompt: `Generate content for lesson: ${lesson.title}`,
            status: "failed",
            error:
              lessonError instanceof Error
                ? lessonError.message
                : "Unknown error",
            durationMs: Date.now() - startTime,
          });
        }
      }
    } finally {
      await recalculateModuleStatus(moduleId);
    }

    const failedLessons = await Lesson.countDocuments({
      module: moduleId,
      generationStatus: "failed",
    });

    await sendNotification({
      userId,
      type: "ai.generation.completed",
      title: "Content generation complete",
      message: `Module "${courseModule.title}" content has been generated`,
      link: `/courses/${courseId}`,
    });

    return {
      moduleId,
      totalLessons: lessons.length,
      failedLessons,
      durationMs: Date.now() - startTime,
    };
  }
);

// ──────── ai.generate-lesson-content ────────
registerHandler(
  "ai.generate-lesson-content",
  async (data: Record<string, unknown>) => {
    const startTime = Date.now();
    const {
      courseId,
      lessonId,
      tier,
      provider,
      model,
      feedback,
      userId,
    } = data as {
      courseId: string;
      lessonId: string;
      tier?: string;
      provider?: string;
      model?: string;
      feedback?: string;
      userId: string;
    };

    await dbConnect();

    const course = await Course.findOne({
      _id: courseId,
      owner: userId,
    });

    if (!course) throw new Error("Course not found");

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) throw new Error("Lesson not found");

    const courseModule = await Module.findOne({
      _id: lesson.module,
      course: courseId,
    });
    if (!courseModule) throw new Error("Module not found");

    const userPreferences =
      tier || provider
        ? undefined
        : await getUserAIPreferences(userId);

    const resolved = resolveProvider({
      requestProvider: provider as AIProviderName,
      requestModel: model,
      requestTier: tier as AITier,
      coursePreferences: course.aiPreferences,
      userPreferences,
    });

    if (!resolved) {
      captureException(new Error(`Provider not configured: ${provider || "default"}`), {
        operation: "resolve-provider",
        jobType: "ai.generate-lesson-content",
      });
      throw new Error("AI service is temporarily unavailable");
    }

    const lessonService = new LessonContentGeneratorService({
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      model: resolved.model,
    });

    lesson.generationStatus = "generating";
    lesson.generationConfig = {
      provider: resolved.provider,
      model: resolved.model,
    };
    await lesson.save();

    const targetLevel = extractTargetLevel(course.syllabusPrompt);

    const previousLessons = await Lesson.find({
      module: lesson.module,
      order: { $lt: lesson.order },
      generationStatus: "completed",
    }).sort({ order: 1 });

    let previousLessonsSummary = "";
    for (const prevLesson of previousLessons) {
      if (prevLesson.keyTakeaways && prevLesson.keyTakeaways.length > 0) {
        previousLessonsSummary += `\n${prevLesson.title}: ${prevLesson.keyTakeaways.join("; ")}`;
      }
    }
    if (previousLessonsSummary.length > MAX_SUMMARY_LENGTH) {
      previousLessonsSummary = previousLessonsSummary.slice(
        -MAX_SUMMARY_LENGTH
      );
    }

    try {
      const { content, usage } = await lessonService.generateLessonContent({
        courseTitle: course.title,
        courseDescription: course.description,
        moduleTitle: courseModule.title,
        lessonTitle: lesson.title,
        lessonOutline: lesson.lessonOutline || "",
        previousLessonsSummary: previousLessonsSummary || undefined,
        targetLevel,
        feedback: feedback || undefined,
        previousContent: feedback ? lesson.content : undefined,
        tier: (tier as AITier) || undefined,
      });

      lesson.content = content.content;
      lesson.keyTakeaways = content.keyTakeaways;
      lesson.generationStatus = "completed";
      await lesson.save();

      await logAIGeneration({
        user: userId,
        course: courseId,
        module: courseModule._id.toString(),
        lesson: lessonId,
        generationType: "lesson_content",
        provider: resolved.provider,
        model: resolved.model || "default",
        prompt: `Generate content for lesson: ${lesson.title}\nOutline: ${lesson.lessonOutline}`,
        response: content.content.substring(0, 5000),
        tokenUsage: usage,
        status: "completed",
        durationMs: Date.now() - startTime,
      });

      await markModuleCompletedIfReady(courseModule._id.toString());

      return {
        lessonId,
        durationMs: Date.now() - startTime,
      };
    } catch (generateError) {
      captureException(generateError, {
        operation: "Error generating lesson content in job",
      });
      lesson.generationStatus = "failed";
      await lesson.save();

      await logAIGeneration({
        user: userId,
        course: courseId,
        module: courseModule._id.toString(),
        lesson: lessonId,
        generationType: "lesson_content",
        provider: resolved.provider,
        model: resolved.model || "default",
        prompt: `Generate content for lesson: ${lesson.title}`,
        status: "failed",
        error:
          generateError instanceof Error
            ? generateError.message
            : "Unknown error",
        durationMs: Date.now() - startTime,
      });

      throw generateError;
    }
  }
);
