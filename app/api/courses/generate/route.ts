import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requireCsrf } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Course } from "@/lib/models";
import { enqueueJob } from "@/lib/queue";
import { enforceAIRateLimit, addRateLimitHeaders } from "@/lib/ai/rateLimit";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { captureException } from "@/lib/logger";
import { getCorrelationId, CORRELATION_HEADER } from "@/lib/telemetry/correlationId";
import { ErrorCodes } from "@/lib/telemetry/errorCodes";
import type { SubscriptionTier } from "@/lib/auth/jwt";

const MAX_GENERATED_COURSES: Record<SubscriptionTier, number> = {
  free: 5,
  plus: Infinity,
  admin: Infinity,
};

const generateCourseSchema = z.object({
  topic: z.string().min(1).max(500),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
});

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = generateCourseSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { topic, skillLevel } = validation.data;

    await dbConnect();

    const subTier =
      user.role === "admin" ? ("admin" as const) : user.subscriptionTier;
    const maxCourses = MAX_GENERATED_COURSES[subTier];

    if (isFinite(maxCourses)) {
      const courseCount = await Course.countDocuments({ owner: user.userId });
      if (courseCount >= maxCourses) {
        return NextResponse.json(
          {
            error: `You've reached the maximum of ${maxCourses} generated courses. Delete a course to create a new one.`,
          },
          { status: 429 }
        );
      }
    }
    const rateCheck = await enforceAIRateLimit(
      user.userId,
      subTier,
      "credits"
    );
    if (rateCheck.blocked) return rateCheck.response;

    const resolved = resolveProvider({});
    if (!resolved) {
      captureException(new Error("Provider not configured"), {
        operation: "resolve-provider",
        correlationId,
      });
      return NextResponse.json(
        {
          error: "AI service is temporarily unavailable. Please try again later.",
          code: ErrorCodes.PROVIDER_RESOLUTION_FAILED,
          correlationId,
        },
        { status: 503 }
      );
    }

    const jobId = await enqueueJob({
      type: "ai.generate-syllabus",
      data: {
        topic,
        targetLevel: skillLevel,
        estimatedDuration: "4-6 hours",
        includeVideos: true,
      },
      userId: user.userId,
    });

    const jsonResponse = NextResponse.json({ jobId }, { status: 202 });
    jsonResponse.headers.set(CORRELATION_HEADER, correlationId);
    if (!rateCheck.blocked) {
      addRateLimitHeaders(jsonResponse, rateCheck.result);
    }
    return jsonResponse;
  } catch (error) {
    captureException(error, { operation: "Generate course error", correlationId });
    return NextResponse.json(
      { error: "Something went wrong. Please try again later.", correlationId },
      { status: 500 }
    );
  }
}
