import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Course, Module, Lesson } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { AIProviderName, AITier } from "@/lib/ai/types";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { getUserAIPreferences } from "@/lib/ai/utils/userPreferences";
import { generateContentSchema } from "@/lib/validation/aiSchemas";
import { enqueueJob } from "@/lib/queue";
import { enforceAIRateLimit, addRateLimitHeaders } from "@/lib/ai/rateLimit";
import { captureException } from "@/lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit check — single lesson costs 1 credit
    const subTier = user.role === "admin" ? "admin" as const : user.subscriptionTier;
    const rateCheck = await enforceAIRateLimit(user.userId, subTier, "credits");
    if (rateCheck.blocked) return rateCheck.response;

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

    // Fail fast: verify provider
    const { tier: reqTier, provider: reqProvider, model: reqModel } = validation.data;
    const userPreferences = (reqTier || reqProvider) ? undefined : await getUserAIPreferences(user.userId);

    const resolved = resolveProvider({
      requestProvider: reqProvider as AIProviderName,
      requestModel: reqModel,
      requestTier: reqTier as AITier,
      coursePreferences: course.aiPreferences,
      userPreferences,
    });

    if (!resolved) {
      const requestedProvider =
        reqProvider ||
        course.aiPreferences?.defaultProvider ||
        process.env.AI_PROVIDER ||
        "openai";
      // DEBUG: temporary logging to diagnose Vercel env var issue
      console.error("[DEBUG] resolveProvider returned null", {
        requestedProvider,
        reqProvider,
        reqTier,
        coursePrefs: course.aiPreferences,
        envAIProvider: process.env.AI_PROVIDER,
        groqKeyLength: process.env.GROQ_API_KEY?.length ?? 0,
        openaiKeyLength: process.env.OPENAI_API_KEY?.length ?? 0,
        anthropicKeyLength: process.env.ANTHROPIC_API_KEY?.length ?? 0,
        availableKeys: ["GROQ_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "CEREBRAS_API_KEY"]
          .filter(k => !!process.env[k])
          .join(", "),
      });
      return NextResponse.json(
        { error: `API key not configured for provider: ${requestedProvider}` },
        { status: 500 }
      );
    }

    const jobId = await enqueueJob({
      type: "ai.generate-lesson-content",
      data: {
        courseId,
        lessonId,
        tier: reqTier,
        provider: reqProvider,
        model: reqModel,
        feedback: validation.data.feedback,
      },
      userId: user.userId,
    });

    const jsonResponse = NextResponse.json({ jobId }, { status: 202 });
    addRateLimitHeaders(jsonResponse, rateCheck.result);
    return jsonResponse;
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
