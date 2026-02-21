import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import {
  getAvailableTiers,
  getConfiguredProviders,
  TIER_CATALOG,
  TIER_METADATA,
  resolveTier,
} from "@/lib/ai/utils/tierCatalog";
import { AITier } from "@/lib/ai/types";
import { captureException } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const availableTiers = getAvailableTiers();
    const configuredProviders = getConfiguredProviders();

    const tierDetails = (["fast", "balanced", "powerful"] as AITier[]).map(
      (tier) => {
        const resolved = resolveTier(tier);
        return {
          tier,
          ...TIER_METADATA[tier],
          available: availableTiers.includes(tier),
          resolvedProvider: resolved?.provider ?? null,
          resolvedModel: resolved?.model ?? null,
          candidates: TIER_CATALOG[tier].map((c) => ({
            provider: c.provider,
            model: c.model,
            available: configuredProviders.includes(c.provider),
          })),
        };
      }
    );

    return NextResponse.json({
      tiers: tierDetails,
      configuredProviders,
    });
  } catch (error) {
    captureException(error, { operation: "Get AI config error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
