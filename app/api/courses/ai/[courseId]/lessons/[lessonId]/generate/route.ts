import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Course, Module, Lesson, AIGenerationLog } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { AIProviderName } from "@/lib/ai/types";
import { LessonContentGeneratorService } from "@/lib/ai/services/lessonContentGenerator";
import { TargetLevel } from "@/lib/ai/services/syllabusGenerator";

const API_KEY_ENV_MAP: Record<AIProviderName, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  gemini: "GEMINI_API_KEY",
};

const generateContentSchema = z.object({
  provider: z.enum(["openai", "anthropic", "groq", "cerebras", "gemini"]).optional(),
  model: z.string().optional(),
});

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

    const selectedProvider =
      (validation.data.provider as AIProviderName) ||
      course.aiPreferences?.defaultProvider ||
      (process.env.AI_PROVIDER as AIProviderName) ||
      "openai";

    const envVar = API_KEY_ENV_MAP[selectedProvider];
    const apiKey = process.env[envVar];

    if (!apiKey) {
      return NextResponse.json(
        { error: `API key not configured for provider: ${selectedProvider}` },
        { status: 500 }
      );
    }

    const selectedModel =
      validation.data.model ||
      course.aiPreferences?.defaultModel ||
      process.env.AI_MODEL;

    const lessonService = new LessonContentGeneratorService({
      provider: selectedProvider,
      apiKey,
      model: selectedModel,
    });

    lesson.generationStatus = "generating";
    lesson.generationConfig = {
      provider: selectedProvider,
      model: selectedModel,
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

      await AIGenerationLog.create({
        user: user.userId,
        course: courseId,
        module: courseModule._id,
        lesson: lessonId,
        generationType: "lesson_content",
        provider: selectedProvider,
        aiModel: selectedModel || "default",
        prompt: `Generate content for lesson: ${lesson.title}\nOutline: ${lesson.lessonOutline}`,
        response: content.content.substring(0, 5000),
        tokenUsage: usage,
        status: "completed",
        durationMs: Date.now() - startTime,
      });

      const allModuleLessonsCompleted =
        (await Lesson.countDocuments({
          module: courseModule._id,
          generationStatus: { $ne: "completed" },
        })) === 0;

      if (allModuleLessonsCompleted) {
        courseModule.contentStatus = "completed";
        await courseModule.save();
      }

      return NextResponse.json({
        lesson,
        usage,
        durationMs: Date.now() - startTime,
      });
    } catch (generateError) {
      console.error("Error generating lesson content:", generateError);

      lesson.generationStatus = "failed";
      await lesson.save();

      await AIGenerationLog.create({
        user: user.userId,
        course: courseId,
        module: courseModule._id,
        lesson: lessonId,
        generationType: "lesson_content",
        provider: selectedProvider,
        aiModel: selectedModel || "default",
        prompt: `Generate content for lesson: ${lesson.title}`,
        status: "failed",
        error:
          generateError instanceof Error ? generateError.message : "Unknown error",
        durationMs: Date.now() - startTime,
      });

      throw generateError;
    }
  } catch (error) {
    console.error("Generate lesson content error:", error);
    return NextResponse.json(
      {
        error: `Failed to generate content: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}

function extractTargetLevel(syllabusPrompt?: string): TargetLevel {
  if (!syllabusPrompt) return "intermediate";

  const lowerPrompt = syllabusPrompt.toLowerCase();

  if (lowerPrompt.includes("level: beginner")) return "beginner";
  if (lowerPrompt.includes("level: advanced")) return "advanced";

  return "intermediate";
}
