import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import {
  getConfiguredProviders,
  TIER_CATALOG,
  TIER_METADATA,
  resolveTier,
} from "@/lib/ai/utils/tierCatalog";
import { MODEL_REGISTRY, getProviderDisplayName } from "@/lib/ai/utils/modelRegistry";
import { getApiKey } from "@/lib/ai/utils/apiKeys";
import { AITier } from "@/lib/ai/types";
import { captureException } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configuredProviders = getConfiguredProviders();

    const tierDetails = (["concise", "balanced", "thorough"] as AITier[]).map(
      (tier) => {
        const resolved = resolveTier(tier);
        return {
          tier,
          ...TIER_METADATA[tier],
          available: resolved !== null,
          resolvedProvider: resolved?.provider ?? null,
          resolvedModel: resolved?.model ?? null,
          resolvedDisplayName: resolved?.displayName ?? null,
          resolvedProviderDisplayName: resolved?.providerDisplayName ?? null,
          candidates: TIER_CATALOG[tier].map((c) => ({
            provider: c.provider,
            model: c.model,
            displayName: c.displayName,
            providerDisplayName: c.providerDisplayName,
            available: configuredProviders.includes(c.provider),
          })),
        };
      }
    );

    // All registry models whose provider has a configured API key
    const availableModels = MODEL_REGISTRY
      .filter((m) => getApiKey(m.provider) !== null)
      .map((m) => ({
        id: m.id,
        displayName: m.displayName,
        provider: m.provider,
        providerDisplayName: getProviderDisplayName(m.provider),
      }));

    return NextResponse.json({
      tiers: tierDetails,
      configuredProviders,
      availableModels,
    });
  } catch (error) {
    captureException(error, { operation: "Get AI config error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
