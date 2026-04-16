import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Course, Module, Lesson } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { AIProviderName, AITier } from "@/lib/ai/types";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { getUserAIPreferences } from "@/lib/ai/utils/userPreferences";
import { generateContentSchema } from "@/lib/validation/aiSchemas";
import { LessonContentGeneratorService } from "@/lib/ai/services/lessonContentGenerator";
import { extractTargetLevel } from "@/lib/ai/utils/promptUtils";
import { enforceAIRateLimit } from "@/lib/ai/rateLimit";
import { logAIGeneration } from "@/lib/utils/aiGenerationLogger";
import { markModuleCompletedIfReady } from "@/lib/utils/moduleStatusUpdater";
import { captureException } from "@/lib/logger";
import { getCorrelationId, CORRELATION_HEADER } from "@/lib/telemetry/correlationId";
import { ErrorCodes } from "@/lib/telemetry/errorCodes";
import { AIProviderError } from "@/lib/ai/errors";

export const maxDuration = 120;

const MAX_SUMMARY_LENGTH = 2000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const course = await Course.findById(courseId);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const perms = await getCoursePermissions(course, user);
    if (!perms.canEdit && !perms.isSharedWith) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    // Atomic check-and-set to prevent concurrent generation
    const claimed = await Lesson.findOneAndUpdate(
      { _id: lessonId, generationStatus: { $ne: "generating" } },
      {
        $set: {
          generationStatus: "generating",
          generationConfig: { provider: resolved.provider, model: resolved.model },
          ...(lesson.content
            ? { previousContent: lesson.content, previousKeyTakeaways: lesson.keyTakeaways || [] }
            : {}),
        },
      },
      { new: true }
    );

    if (!claimed) {
      return NextResponse.json(
        { error: "Lesson is already being generated" },
        { status: 409 }
      );
    }

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
    if (previousLessonsSummary.length > MAX_SUMMARY_LENGTH) {
      previousLessonsSummary = previousLessonsSummary.slice(-MAX_SUMMARY_LENGTH);
    }

    const encoder = new TextEncoder();
    let closed = false;
    const startTime = Date.now();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            closed = true;
          }
        };

        try {
          const lessonService = new LessonContentGeneratorService({
            provider: resolved.provider,
            apiKey: resolved.apiKey,
            model: resolved.model,
          });

          const generator = lessonService.streamLessonContent({
            courseTitle: course.title,
            courseDescription: course.description,
            moduleTitle: courseModule.title,
            lessonTitle: lesson.title,
            lessonOutline: lesson.lessonOutline || "",
            previousLessonsSummary: previousLessonsSummary || undefined,
            targetLevel,
            feedback: validation.data.feedback || undefined,
            previousContent: validation.data.feedback ? lesson.previousContent : undefined,
            tier: (reqTier as AITier) || undefined,
          });

          for await (const event of generator) {
            if (closed) break;

            if (event.type === "chunk") {
              send("chunk", { text: event.text });
            } else if (event.type === "complete") {
              lesson.content = event.content;
              lesson.keyTakeaways = event.keyTakeaways;
              lesson.sources = event.sources?.length ? event.sources : undefined;
              lesson.generationStatus = "completed";
              await lesson.save();

              send("done", {
                keyTakeaways: event.keyTakeaways,
                sources: event.sources || [],
              });

              after(async () => {
                try {
                  await logAIGeneration({
                    user: user.userId,
                    course: courseId,
                    module: courseModule._id.toString(),
                    lesson: lessonId,
                    generationType: "lesson_content",
                    provider: resolved.provider,
                    model: resolved.model || "default",
                    prompt: `Generate content for lesson: ${lesson.title}\nOutline: ${lesson.lessonOutline}`,
                    response: event.content.substring(0, 5000),
                    tokenUsage: event.usage,
                    status: "completed",
                    durationMs: Date.now() - startTime,
                  });
                } catch (e) {
                  captureException(e, { operation: "log-ai-generation" });
                }

                try {
                  await markModuleCompletedIfReady(courseModule._id.toString());
                } catch (e) {
                  captureException(e, { operation: "mark-module-completed" });
                }
              });
            }
          }
        } catch (error) {
          captureException(error, {
            operation: "Stream lesson generation error",
            correlationId,
          });

          try {
            lesson.generationStatus = "failed";
            await lesson.save();
          } catch {
            // best effort
          }

          const isAIError = error instanceof AIProviderError;
          send("error", {
            code: isAIError ? error.errorCode : ErrorCodes.AI_UNKNOWN,
            message: isAIError && error.isTransient
              ? "The AI service is busy. Please try again in a moment."
              : "Generation failed. Please try again later.",
            isTransient: isAIError ? error.isTransient : false,
            correlationId,
          });
        } finally {
          if (!closed) {
            controller.close();
          }
        }
      },
    });

    request.signal.addEventListener("abort", () => {
      closed = true;
      Lesson.findById(lessonId).then((l) => {
        if (l && l.generationStatus === "generating") {
          l.generationStatus = "failed";
          l.save().catch(() => {});
        }
      }).catch(() => {});
    });

    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      [CORRELATION_HEADER]: correlationId,
      "X-RateLimit-Limit": String(rateCheck.result.limit),
      "X-RateLimit-Remaining": String(rateCheck.result.remaining),
      "X-RateLimit-Reset": rateCheck.result.resetAt,
    });

    return new Response(stream, { headers });
  } catch (error) {
    captureException(error, { operation: "Generate lesson content error", correlationId });
    return NextResponse.json(
      { error: "Something went wrong. Please try again later.", correlationId },
      { status: 500 }
    );
  }
}
