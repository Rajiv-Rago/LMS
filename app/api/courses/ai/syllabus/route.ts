import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Module, Lesson } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { AIProviderName } from "@/lib/ai/types";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import {
  SyllabusGeneratorService,
  TargetLevel,
} from "@/lib/ai/services/syllabusGenerator";
import { logAIGeneration } from "@/lib/utils/aiGenerationLogger";

const createSyllabusSchema = z.object({
  topic: z.string().min(1).max(500),
  targetLevel: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedDuration: z.string().min(1).max(100),
  additionalContext: z.string().max(2000).optional(),
  provider: z.enum(["openai", "anthropic", "groq", "cerebras", "gemini"]).optional(),
  model: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createSyllabusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { topic, targetLevel, estimatedDuration, additionalContext, provider, model } =
      validation.data;

    const resolved = resolveProvider({
      requestProvider: provider as AIProviderName,
      requestModel: model,
    });

    if (!resolved) {
      const selectedProvider = provider || process.env.AI_PROVIDER || "openai";
      return NextResponse.json(
        { error: `API key not configured for provider: ${selectedProvider}` },
        { status: 500 }
      );
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
    });

    const course = await Course.create({
      title: syllabus.courseTitle,
      description: syllabus.courseDescription,
      instructor: user.userId,
      courseType: "ai-generated",
      owner: user.userId,
      syllabusStatus: "completed",
      syllabusPrompt: `Topic: ${topic}\nLevel: ${targetLevel}\nDuration: ${estimatedDuration}${additionalContext ? `\nContext: ${additionalContext}` : ""}`,
      aiPreferences: {
        defaultProvider: resolved.provider,
        defaultModel: resolved.model,
      },
      isPublished: false,
    });

    const modulePromises = syllabus.modules.map(async (moduleData, moduleIndex) => {
      const courseModule = await Module.create({
        title: moduleData.title,
        description: moduleData.description,
        course: course._id,
        order: moduleData.order ?? moduleIndex,
        contentStatus: "skeleton",
        isPublished: false,
      });

      const lessonPromises = moduleData.lessons.map(async (lessonData, lessonIndex) => {
        const lesson = await Lesson.create({
          title: lessonData.title,
          module: courseModule._id,
          contentType: "text",
          content: "",
          order: lessonData.order ?? lessonIndex,
          generationStatus: "skeleton",
          lessonOutline: lessonData.outline,
          isPublished: false,
        });
        return lesson;
      });

      const lessons = await Promise.all(lessonPromises);
      courseModule.lessons = lessons.map((l) => l._id);
      await courseModule.save();

      return courseModule;
    });

    const modules = await Promise.all(modulePromises);
    course.modules = modules.map((m) => m._id);
    await course.save();

    await logAIGeneration({
      user: user.userId,
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

    const populatedCourse = await Course.findById(course._id)
      .populate({
        path: "modules",
        populate: {
          path: "lessons",
          model: "Lesson",
        },
      })
      .populate("owner", "name email");

    return NextResponse.json({ course: populatedCourse }, { status: 201 });
  } catch (error) {
    console.error("Create syllabus error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to generate syllabus: ${errorMessage}` },
      { status: 500 }
    );
  }
}
