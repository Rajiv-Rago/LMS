import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Course, Module, Lesson } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { AIProviderName } from "@/lib/ai/types";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { extractTargetLevel } from "@/lib/ai/utils/promptUtils";
import { LessonContentGeneratorService } from "@/lib/ai/services/lessonContentGenerator";
import { generateContentSchema } from "@/lib/validation/aiSchemas";
import { logAIGeneration } from "@/lib/utils/aiGenerationLogger";
import { recalculateModuleStatus } from "@/lib/utils/moduleStatusUpdater";
import { captureException } from "@/lib/logger";

const MAX_SUMMARY_LENGTH = 2000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> }
) {
  const startTime = Date.now();

  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courseId, moduleId } = await params;

    if (
      !mongoose.Types.ObjectId.isValid(courseId) ||
      !mongoose.Types.ObjectId.isValid(moduleId)
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

    const courseModule = await Module.findOne({
      _id: moduleId,
      course: courseId,
    }).populate("lessons");

    if (!courseModule) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const resolved = resolveProvider({
      requestProvider: validation.data.provider as AIProviderName,
      requestModel: validation.data.model,
      coursePreferences: course.aiPreferences,
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

          // Limit previousLessonsSummary size to avoid prompt bloat
          let summaryForPrompt = previousLessonsSummary;
          if (summaryForPrompt.length > MAX_SUMMARY_LENGTH) {
            summaryForPrompt = summaryForPrompt.slice(-MAX_SUMMARY_LENGTH);
          }

          const { content, usage } = await lessonService.generateLessonContent({
            courseTitle: course.title,
            courseDescription: course.description,
            moduleTitle: courseModule.title,
            lessonTitle: lesson.title,
            lessonOutline: lesson.lessonOutline || "",
            previousLessonsSummary: summaryForPrompt || undefined,
            targetLevel,
          });

          lesson.content = content.content;
          lesson.keyTakeaways = content.keyTakeaways;
          lesson.generationStatus = "completed";
          await lesson.save();

          await logAIGeneration({
            user: user.userId,
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
          captureException(lessonError, { message: `Error generating lesson ${lesson._id}` });

          lesson.generationStatus = "failed";
          await lesson.save();

          await logAIGeneration({
            user: user.userId,
            course: courseId,
            module: moduleId,
            lesson: lesson._id.toString(),
            generationType: "lesson_content",
            provider: resolved.provider,
            model: resolved.model || "default",
            prompt: `Generate content for lesson: ${lesson.title}`,
            status: "failed",
            error: lessonError instanceof Error ? lessonError.message : "Unknown error",
            durationMs: Date.now() - startTime,
          });
        }
      }
    } finally {
      // Recalculate module status even if an error occurred
      await recalculateModuleStatus(moduleId);
    }

    const failedLessons = await Lesson.countDocuments({
      module: moduleId,
      generationStatus: "failed",
    });

    const skeletonLessons = await Lesson.countDocuments({
      module: moduleId,
      generationStatus: "skeleton",
    });

    const updatedModule = await Module.findById(moduleId).populate("lessons");

    return NextResponse.json({
      module: updatedModule,
      stats: {
        totalLessons: lessons.length,
        completedLessons: lessons.length - failedLessons - skeletonLessons,
        failedLessons,
        durationMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    captureException(error, { message: "Generate module content error" });
    return NextResponse.json(
      {
        error: `Failed to generate content: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
