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
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courseId } = await params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
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

    // Find eligible modules (skeleton or failed — skip generating and completed)
    const eligibleModules = await Module.find({
      course: courseId,
      contentStatus: { $in: ["skeleton", "failed"] },
    }).sort({ order: 1 });

    if (eligibleModules.length === 0) {
      return NextResponse.json({
        jobs: [],
        message: "All modules already completed or generating",
      });
    }

    // Count total lessons across all eligible modules to determine credit cost
    const eligibleModuleIds = eligibleModules.map((m) => m._id);
    const totalLessonCount = await Lesson.countDocuments({
      module: { $in: eligibleModuleIds },
    });
    const creditCost = Math.max(totalLessonCount, 1);

    // Rate limit check — costs 1 credit per lesson across all eligible modules
    const subTier = user.role === "admin" ? "admin" as const : user.subscriptionTier;
    const rateCheck = await enforceAIRateLimit(user.userId, subTier, "credits", creditCost);
    if (rateCheck.blocked) return rateCheck.response;

    // Fail fast: verify provider before enqueueing any jobs
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
      captureException(new Error(`Provider not configured: ${requestedProvider}`), {
        operation: "resolve-provider",
      });
      return NextResponse.json(
        { error: "AI service is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    // Enqueue a job for each eligible module
    const jobs = [];
    for (const mod of eligibleModules) {
      const jobId = await enqueueJob({
        type: "ai.generate-module-content",
        data: {
          courseId,
          moduleId: mod._id.toString(),
          tier: reqTier,
          provider: reqProvider,
          model: reqModel,
        },
        userId: user.userId,
      });

      jobs.push({
        moduleId: mod._id.toString(),
        moduleTitle: mod.title,
        jobId,
      });
    }

    const jsonResponse = NextResponse.json({ jobs }, { status: 202 });
    addRateLimitHeaders(jsonResponse, rateCheck.result);
    return jsonResponse;
  } catch (error) {
    captureException(error, { operation: "Generate all modules content error" });
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}
