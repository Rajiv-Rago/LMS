import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireCsrf } from "@/lib/auth";
import { AIProviderName, AITier } from "@/lib/ai/types";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { getUserAIPreferences } from "@/lib/ai/utils/userPreferences";
import { youtubePathFormSchema } from "@/lib/validation/youtubeSchemas";
import { enqueueJob } from "@/lib/queue";
import { enforceAIRateLimit, addRateLimitHeaders } from "@/lib/ai/rateLimit";
import { env } from "@/lib/env";
import { captureException } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit check
    const subTier = user.role === "admin" ? ("admin" as const) : user.subscriptionTier;
    const rateCheck = await enforceAIRateLimit(user.userId, subTier, "credits");
    if (rateCheck.blocked) return rateCheck.response;

    if (!env.YOUTUBE_API_KEY) {
      return NextResponse.json(
        { error: "YouTube API key is not configured. Contact the administrator." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = youtubePathFormSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { topic, skillLevel, teachingStyle, videoLengthPreference, pathVariant, tier, provider, model } =
      validation.data;

    // Verify provider is configured before enqueueing
    const userPreferences = tier || provider ? undefined : await getUserAIPreferences(user.userId);

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
      type: "ai.generate-youtube-path",
      data: { topic, skillLevel, teachingStyle, videoLengthPreference, pathVariant, tier, provider, model },
      userId: user.userId,
    });

    const jsonResponse = NextResponse.json({ jobId }, { status: 202 });
    addRateLimitHeaders(jsonResponse, rateCheck.result);
    return jsonResponse;
  } catch (error) {
    captureException(error, { operation: "Generate YouTube path error" });

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to generate YouTube path: ${errorMessage}` },
      { status: 500 }
    );
  }
}
