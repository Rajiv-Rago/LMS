import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Course, Module, Lesson } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { AIProviderName, AITier } from "@/lib/ai/types";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { getUserAIPreferences } from "@/lib/ai/utils/userPreferences";
import { extractTargetLevel } from "@/lib/ai/utils/promptUtils";
import { LessonContentGeneratorService } from "@/lib/ai/services/lessonContentGenerator";
import { generateContentSchema } from "@/lib/validation/aiSchemas";
import { logAIGeneration } from "@/lib/utils/aiGenerationLogger";
import { markModuleCompletedIfReady } from "@/lib/utils/moduleStatusUpdater";
import { captureException } from "@/lib/logger";

const MAX_SUMMARY_LENGTH = 2000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  const startTime = Date.now();

  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courseId, lessonId } = await params;

    if (
      !mongoose.Types.ObjectId.isValid(courseId) ||
      !mongoose.Types.ObjectId.isValid(lessonId)
    ) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const validation = generateContentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    await dbConnect();

    const course = await Course.findOne({
      _id: courseId,
      courseType: "ai-generated",
      owner: user.userId,
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.syllabusStatus !== "completed") {
      return NextResponse.json(
        { error: "Syllabus generation must be completed first" },
        { status: 400 }
      );
    }

    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const courseModule = await Module.findOne({
      _id: lesson.module,
      course: courseId,
    });

    if (!courseModule) {
      return NextResponse.json(
        { error: "Lesson does not belong to this course" },
        { status: 404 }
      );
    }

    const userPreferences = await getUserAIPreferences(user.userId);

    const resolved = resolveProvider({
      requestProvider: validation.data.provider as AIProviderName,
      requestModel: validation.data.model,
      requestTier: validation.data.tier as AITier,
      coursePreferences: course.aiPreferences,
      userPreferences,
    });

    if (!resolved) {
      const requestedProvider =
        validation.data.provider ||
        course.aiPreferences?.defaultProvider ||
        process.env.AI_PROVIDER ||
        "openai";
      return NextResponse.json(
        { error: `API key not configured for provider: ${requestedProvider}` },
        { status: 500 }
      );
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

    // Limit previousLessonsSummary size to avoid prompt bloat
    if (previousLessonsSummary.length > MAX_SUMMARY_LENGTH) {
      previousLessonsSummary = previousLessonsSummary.slice(-MAX_SUMMARY_LENGTH);
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
      });

      lesson.content = content.content;
      lesson.keyTakeaways = content.keyTakeaways;
      lesson.generationStatus = "completed";
      await lesson.save();

      await logAIGeneration({
        user: user.userId,
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

      // Update module status if all lessons are now completed
      await markModuleCompletedIfReady(courseModule._id.toString());

      return NextResponse.json({
        lesson,
        usage,
        durationMs: Date.now() - startTime,
      });
    } catch (generateError) {
      captureException(generateError, { operation: "Error generating lesson content" });

      lesson.generationStatus = "failed";
      await lesson.save();

      await logAIGeneration({
        user: user.userId,
        course: courseId,
        module: courseModule._id.toString(),
        lesson: lessonId,
        generationType: "lesson_content",
        provider: resolved.provider,
        model: resolved.model || "default",
        prompt: `Generate content for lesson: ${lesson.title}`,
        status: "failed",
        error:
          generateError instanceof Error ? generateError.message : "Unknown error",
        durationMs: Date.now() - startTime,
      });

      throw generateError;
    }
  } catch (error) {
    captureException(error, { operation: "Generate lesson content error" });
    return NextResponse.json(
      {
        error: `Failed to generate content: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
