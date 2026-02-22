import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Course, Module } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { AIProviderName, AITier } from "@/lib/ai/types";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { getUserAIPreferences } from "@/lib/ai/utils/userPreferences";
import { generateContentSchema } from "@/lib/validation/aiSchemas";
import { enqueueJob } from "@/lib/queue";
import { enforceAIRateLimit, addRateLimitHeaders } from "@/lib/ai/rateLimit";
import { captureException } from "@/lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> }
) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit check
    const rateCheck = await enforceAIRateLimit(user.userId, user.role, "course_generation");
    if (rateCheck.blocked) return rateCheck.response;

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
    });

    if (!courseModule) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
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
      return NextResponse.json(
        { error: `API key not configured for provider: ${requestedProvider}` },
        { status: 500 }
      );
    }

    const jobId = await enqueueJob({
      type: "ai.generate-module-content",
      data: {
        courseId,
        moduleId,
        tier: reqTier,
        provider: reqProvider,
        model: reqModel,
      },
      userId: user.userId,
    });

    const jsonResponse = NextResponse.json({ jobId }, { status: 202 });
    addRateLimitHeaders(jsonResponse, rateCheck.result);
    return jsonResponse;
  } catch (error) {
    captureException(error, { operation: "Generate module content error" });
    return NextResponse.json(
      {
        error: `Failed to generate content: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
