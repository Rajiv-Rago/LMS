import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Lesson, AIChatSession } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { createAIProvider, resolveProvider } from "@/lib/ai";
import { AITier, AIProviderName } from "@/lib/ai/types";
import { getUserAIPreferences } from "@/lib/ai/utils/userPreferences";
import { AITutorService } from "@/lib/ai/services/tutor";
import { aiTierSchema, aiProviderSchema } from "@/lib/validation/aiSchemas";
import { enforceAIRateLimit, addRateLimitHeaders } from "@/lib/ai/rateLimit";
import { captureException } from "@/lib/logger";

const createChatSchema = z
  .object({
    courseId: z.string(),
    lessonId: z.string().optional(),
    message: z.string().min(1).max(5000),
    sessionId: z.string().optional(),
    tier: aiTierSchema.optional(),
    provider: aiProviderSchema.optional(),
    model: z.string().max(256).optional(),
  })
  .refine((data) => !(data.tier && data.provider), {
    message: "Cannot specify both tier and provider",
    path: ["tier"],
  });

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const { courseId, lessonId, message, sessionId, tier, provider: reqProvider, model: reqModel } = validation.data;

    await dbConnect();

    const course = await Course.findById(courseId);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isEnrolled = course.enrolledStudents.some(
      (s: { toString: () => string }) => s.toString() === user.userId
    );
    const isInstructor = course.instructor.toString() === user.userId;

    if (!isEnrolled && !isInstructor && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let lesson = null;
    if (lessonId) {
      lesson = await Lesson.findById(lessonId);
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
      return NextResponse.json(
        { error: "No AI provider configured. Please set up an API key." },
        { status: 500 }
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
      session = await AIChatSession.create({
        user: user.userId,
        course: courseId,
        lesson: lessonId,
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

    const response = await tutorService.chat(conversationHistory, {
      courseName: course.title,
      lessonTitle: lesson?.title,
      lessonContent: lesson?.content,
      aiContext: lesson?.aiContext,
    });

    session.messages.push({
      role: "assistant",
      content: response.content,
      timestamp: new Date(),
    });

    await session.save();

    const jsonResponse = NextResponse.json({
      sessionId: session._id,
      message: {
        role: "assistant",
        content: response.content,
      },
    });
    addRateLimitHeaders(jsonResponse, rateCheck.result);
    return jsonResponse;
  } catch (error) {
    captureException(error, { operation: "AI chat error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
