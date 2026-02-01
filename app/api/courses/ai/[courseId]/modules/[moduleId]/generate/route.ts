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

    const courseModule = await Module.findOne({
      _id: moduleId,
      course: courseId,
    }).populate("lessons");

    if (!courseModule) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
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

    courseModule.contentStatus = "generating";
    courseModule.generationConfig = {
      provider: selectedProvider,
      model: selectedModel,
    };
    await courseModule.save();

    const targetLevel = extractTargetLevel(course.syllabusPrompt);
    const lessons = await Lesson.find({ module: moduleId }).sort({ order: 1 });

    let previousLessonsSummary = "";

    for (const lesson of lessons) {
      try {
        lesson.generationStatus = "generating";
        lesson.generationConfig = {
          provider: selectedProvider,
          model: selectedModel,
        };
        await lesson.save();

        const lessonStartTime = Date.now();

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
          module: moduleId,
          lesson: lesson._id,
          generationType: "lesson_content",
          provider: selectedProvider,
          aiModel: selectedModel || "default",
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
        console.error(`Error generating lesson ${lesson._id}:`, lessonError);

        lesson.generationStatus = "failed";
        await lesson.save();

        await AIGenerationLog.create({
          user: user.userId,
          course: courseId,
          module: moduleId,
          lesson: lesson._id,
          generationType: "lesson_content",
          provider: selectedProvider,
          aiModel: selectedModel || "default",
          prompt: `Generate content for lesson: ${lesson.title}`,
          status: "failed",
          error: lessonError instanceof Error ? lessonError.message : "Unknown error",
          durationMs: Date.now() - startTime,
        });
      }
    }

    const failedLessons = await Lesson.countDocuments({
      module: moduleId,
      generationStatus: "failed",
    });

    const skeletonLessons = await Lesson.countDocuments({
      module: moduleId,
      generationStatus: "skeleton",
    });

    if (failedLessons > 0) {
      courseModule.contentStatus = "failed";
    } else if (skeletonLessons > 0) {
      courseModule.contentStatus = "skeleton";
    } else {
      courseModule.contentStatus = "completed";
    }
    await courseModule.save();

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
    console.error("Generate module content error:", error);
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
