import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requireCsrf } from "@/lib/auth";
import { AIProviderName, AITier } from "@/lib/ai/types";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { getUserAIPreferences } from "@/lib/ai/utils/userPreferences";
import { aiTierSchema, aiProviderSchema } from "@/lib/validation/aiSchemas";
import { enqueueJob } from "@/lib/queue";
import { enforceAIRateLimit, addRateLimitHeaders } from "@/lib/ai/rateLimit";
import { captureException } from "@/lib/logger";

const createSyllabusSchema = z
  .object({
    topic: z.string().min(1).max(500),
    targetLevel: z.enum(["beginner", "intermediate", "advanced"]),
    estimatedDuration: z.string().min(1).max(100),
    additionalContext: z.string().max(2000).optional(),
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
    const rateCheck = await enforceAIRateLimit(user.userId, subTier, "credits");
    if (rateCheck.blocked) return rateCheck.response;

    const body = await request.json();
    const validation = createSyllabusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { topic, targetLevel, estimatedDuration, additionalContext, tier, provider, model } =
      validation.data;

    // Fail fast: verify provider is configured before enqueueing
    const userPreferences = (tier || provider) ? undefined : await getUserAIPreferences(user.userId);

    const resolved = resolveProvider({
      requestProvider: provider as AIProviderName,
      requestModel: model,
      requestTier: tier as AITier,
      userPreferences,
    });

    if (!resolved) {
      const selectedProvider = provider || process.env.AI_PROVIDER || "openai";
      return NextResponse.json(
        { error: `API key not configured for provider: ${selectedProvider}` },
        { status: 500 }
      );
    }

    const jobId = await enqueueJob({
      type: "ai.generate-syllabus",
      data: { topic, targetLevel, estimatedDuration, additionalContext, tier, provider, model },
      userId: user.userId,
    });

    const jsonResponse = NextResponse.json({ jobId }, { status: 202 });
    addRateLimitHeaders(jsonResponse, rateCheck.result);
    return jsonResponse;
  } catch (error) {
    captureException(error, { operation: "Create syllabus error" });

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to generate syllabus: ${errorMessage}` },
      { status: 500 }
    );
  }
}
