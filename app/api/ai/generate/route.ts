import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Lesson, AIGeneratedContent } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { createAIProvider, resolveProvider } from "@/lib/ai";
import { AITier, AIProviderName } from "@/lib/ai/types";
import { getUserAIPreferences } from "@/lib/ai/utils/userPreferences";
import { AIContentGenerator } from "@/lib/ai/services/generator";
import { aiTierSchema, aiProviderSchema } from "@/lib/validation/aiSchemas";
import { enforceAIRateLimit, addRateLimitHeaders } from "@/lib/ai/rateLimit";
import { captureException } from "@/lib/logger";
import { getCorrelationId, CORRELATION_HEADER } from "@/lib/telemetry/correlationId";
import { ErrorCodes } from "@/lib/telemetry/errorCodes";

const generateSchema = z
  .object({
    courseId: z.string(),
    lessonId: z.string().optional(),
    contentType: z.enum(["quiz", "summary", "practice", "flashcards"]),
    tier: aiTierSchema.optional(),
    provider: aiProviderSchema.optional(),
    model: z.string().max(256).optional(),
    options: z
      .object({
        numQuestions: z.number().min(1).max(20).optional(),
        numProblems: z.number().min(1).max(10).optional(),
        numCards: z.number().min(1).max(30).optional(),
      })
      .optional(),
  })
  .refine((data) => !(data.tier && data.provider), {
    message: "Cannot specify both tier and provider",
    path: ["tier"],
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

    // Rate limit check
    const subTier = user.role === "admin" ? "admin" as const : user.subscriptionTier;
    const rateCheck = await enforceAIRateLimit(user.userId, subTier, "credits");
    if (rateCheck.blocked) return rateCheck.response;

    const body = await request.json();
    const validation = generateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { courseId, lessonId, contentType, tier, provider: reqProvider, model: reqModel, options } = validation.data;

    const invalidCourseId = validateObjectId(courseId, "Course ID");
    if (invalidCourseId) return invalidCourseId;

    await dbConnect();

    const course = await Course.findById(courseId);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const perms = await getCoursePermissions(course, user);

    if (!perms.canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let lesson = null;
    if (lessonId) {
      lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        return NextResponse.json(
          { error: "Lesson not found" },
          { status: 404 }
        );
      }
    }

    const userPreferences = (tier || reqProvider) ? undefined : await getUserAIPreferences(user.userId);

    const resolved = resolveProvider({
      requestProvider: reqProvider as AIProviderName,
      requestModel: reqModel,
      requestTier: tier as AITier,
      coursePreferences: course.aiPreferences,
      userPreferences,
    });

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

    const aiProvider = createAIProvider({
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      model: resolved.model,
    });
    const generator = new AIContentGenerator(aiProvider);

    const context = {
      courseName: course.title,
      lessonTitle: lesson?.title,
      lessonContent: lesson?.content,
      aiContext: lesson?.aiContext,
    };

    let result;
    switch (contentType) {
      case "quiz":
        result = await generator.generateQuiz(context, options?.numQuestions || 5);
        break;
      case "summary":
        result = await generator.generateSummary(context);
        break;
      case "practice":
        result = await generator.generatePracticeProblems(
          context,
          options?.numProblems || 5
        );
        break;
      case "flashcards":
        result = await generator.generateFlashcards(context, options?.numCards || 10);
        break;
    }

    const generatedContent = await AIGeneratedContent.create({
      course: courseId,
      lesson: lessonId,
      generatedBy: user.userId,
      contentType,
      title: result.title,
      content: result.content,
      quizQuestions: result.type === "quiz" ? result.questions : undefined,
      provider: resolved.provider,
      approvalStatus: "pending",
    });

    const jsonResponse = NextResponse.json({ content: generatedContent }, { status: 201 });
    jsonResponse.headers.set(CORRELATION_HEADER, correlationId);
    addRateLimitHeaders(jsonResponse, rateCheck.result);
    return jsonResponse;
  } catch (error) {
    captureException(error, { operation: "AI generate error", correlationId });
    return NextResponse.json(
      { error: "Something went wrong. Please try again later.", correlationId },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const status = searchParams.get("status");
    const contentType = searchParams.get("contentType");

    await dbConnect();

    const query: Record<string, unknown> = {};

    if (courseId) {
      const invalidCourseId = validateObjectId(courseId, "Course ID");
      if (invalidCourseId) return invalidCourseId;

      const course = await Course.findById(courseId);
      if (!course) {
        return NextResponse.json(
          { error: "Course not found" },
          { status: 404 }
        );
      }

      const perms = await getCoursePermissions(course, user);

      if (!perms.canView) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      query.course = courseId;

      if (!perms.canEdit) {
        query.approvalStatus = "approved";
      }
    } else {
      const courses = await Course.find({
        $or: [
          { instructor: user.userId },
          { owner: user.userId },
        ],
      });
      if (courses.length > 0) {
        query.course = { $in: courses.map((c) => c._id) };
      } else if (user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (status) {
      query.approvalStatus = status;
    }

    if (contentType) {
      query.contentType = contentType;
    }

    const contents = await AIGeneratedContent.find(query)
      .populate("course", "title")
      .populate("lesson", "title")
      .populate("generatedBy", "name")
      .sort({ createdAt: -1 });

    return NextResponse.json({ contents });
  } catch (error) {
    captureException(error, { operation: "Get generated content error", correlationId });
    return NextResponse.json(
      { error: "Something went wrong. Please try again later.", correlationId },
      { status: 500 }
    );
  }
}
