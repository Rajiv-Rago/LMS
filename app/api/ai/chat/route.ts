import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, AIChatSession } from "@/lib/models";
import { authenticate, requireCsrf, requireVerifiedEmail } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { createAIProvider, resolveProvider } from "@/lib/ai";
import { AITier, AIProviderName } from "@/lib/ai/types";
import { getUserAIPreferences } from "@/lib/ai/utils/userPreferences";
import { AITutorService } from "@/lib/ai/services/tutor";
import { aiTierSchema, aiProviderSchema } from "@/lib/validation/aiSchemas";
import { enforceAIRateLimit, addRateLimitHeaders } from "@/lib/ai/rateLimit";
import { captureException } from "@/lib/logger";
import { getCorrelationId, CORRELATION_HEADER } from "@/lib/telemetry/correlationId";
import { ErrorCodes } from "@/lib/telemetry/errorCodes";

import { pageContextSchema, resolveTutorContext, TutorContextError } from "@/lib/ai/services/tutorContext";

const createChatSchema = z
  .object({
    courseId: z.string(),
    lessonId: z.string().optional(),
    pageContext: pageContextSchema.optional(),
    message: z.string().min(1).max(5000),
    sessionId: z.string().optional(),
    tier: aiTierSchema.optional(),
    provider: aiProviderSchema.optional(),
    model: z.string().max(256).optional(),
  })
  .refine(data => !(data.lessonId && data.pageContext && (data.pageContext.type !== "lesson" || data.pageContext.entityId !== data.lessonId)), {
    message: "Lesson ID must match page context", path: ["pageContext"],
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

    const verifyError = requireVerifiedEmail(user);
    if (verifyError) return verifyError;

    // Rate limit check
    const subTier = user.role === "admin" ? "admin" as const : user.subscriptionTier;
    const rateCheck = await enforceAIRateLimit(user.userId, subTier, "questions");
    if (rateCheck.blocked) return rateCheck.response;

    const body = await request.json();
    const validation = createChatSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { courseId, lessonId, pageContext, message, sessionId, tier, provider: reqProvider, model: reqModel } = validation.data;

    const invalidCourseId = validateObjectId(courseId, "Course ID");
    if (invalidCourseId) return invalidCourseId;

    await dbConnect();

    const course = await Course.findById(courseId);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const perms = await getCoursePermissions(course, user);

    if (!perms.canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const context = await resolveTutorContext(course, pageContext || (lessonId ? { type: "lesson", entityId: lessonId } : { type: "overview" }), perms.canEdit || perms.isSharedWith);
    if (sessionId) {
      const invalidSessionId = validateObjectId(sessionId, "Session ID");
      if (invalidSessionId) return invalidSessionId;
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

    let session;
    if (sessionId) {
      session = await AIChatSession.findOne({
        _id: sessionId,
        user: user.userId,
        course: courseId,
      });

      if (!session) {
        return NextResponse.json(
          { error: "Chat session not found" },
          { status: 404 }
        );
      }
    } else {
      session = await AIChatSession.findOne({ user: user.userId, course: courseId, isActive: true }).sort({ updatedAt: -1 });
      if (!session) session = await AIChatSession.create({
        user: user.userId,
        course: courseId,
        lesson: pageContext?.type === "lesson" ? pageContext.entityId : lessonId,
        title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
        messages: [],
        provider: resolved.provider,
      });
    }

    session.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    const aiProvider = createAIProvider({
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      model: resolved.model,
    });
    const tutorService = new AITutorService(aiProvider);

    const conversationHistory = session.messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const response = await tutorService.chat(conversationHistory, context);

    session.messages.push({
      role: "assistant",
      content: response.content,
      timestamp: new Date(),
    });

    session.provider = resolved.provider;
    session.aiModel = resolved.model;
    await AIChatSession.updateMany({ user: user.userId, course: courseId, _id: { $ne: session._id }, isActive: true }, { $set: { isActive: false } });
    session.isActive = true;
    await session.save();

    const jsonResponse = NextResponse.json({
      sessionId: session._id,
      message: {
        role: "assistant",
        content: response.content,
      },
    });
    jsonResponse.headers.set(CORRELATION_HEADER, correlationId);
    addRateLimitHeaders(jsonResponse, rateCheck.result);
    return jsonResponse;
  } catch (error) {
    if (error instanceof TutorContextError) return NextResponse.json({ error: error.message }, { status: error.status });
    captureException(error, { operation: "AI chat error", correlationId });
    return NextResponse.json(
      { error: "Something went wrong. Please try again later.", correlationId },
      { status: 500 }
    );
  }
}
