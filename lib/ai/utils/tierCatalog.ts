import { AIProviderName, AITier } from "../types";
import { getApiKey } from "./apiKeys";
import { getModelsForTier, getProviderDisplayName } from "./modelRegistry";

export interface TierCandidate {
  provider: AIProviderName;
  model: string;
  displayName: string;
  providerDisplayName: string;
}

export interface TierMetadata {
  label: string;
  description: string;
}

/**
 * Provider priority order per tier. Models are sorted by this order
 * when building the candidate list from the registry.
 */
const TIER_PROVIDER_ORDER: Record<AITier, AIProviderName[]> = {
  fast: ["groq", "cerebras", "gemini", "openai", "anthropic"],
  balanced: ["openai", "anthropic", "gemini"],
  powerful: ["anthropic", "openai", "gemini"],
};

/**
 * Derives the tier candidate list from MODEL_REGISTRY, ordered by TIER_PROVIDER_ORDER.
 */
function buildTierCandidates(tier: AITier): TierCandidate[] {
  const order = TIER_PROVIDER_ORDER[tier];
  const models = getModelsForTier(tier);

  // Sort models by provider priority order
  const sorted = [...models].sort((a, b) => {
    const ai = order.indexOf(a.provider);
    const bi = order.indexOf(b.provider);
    // Providers not in the priority list go to the end
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  });

  return sorted.map((m) => ({
    provider: m.provider,
    model: m.id,
    displayName: m.displayName,
    providerDisplayName: getProviderDisplayName(m.provider),
  }));
}

export const TIER_CATALOG: Record<AITier, TierCandidate[]> = {
  fast: buildTierCandidates("fast"),
  balanced: buildTierCandidates("balanced"),
  powerful: buildTierCandidates("powerful"),
};

export const TIER_METADATA: Record<AITier, TierMetadata> = {
  fast: {
    label: "Fast",
    description: "Quick responses, good for simple tasks",
  },
  balanced: {
    label: "Balanced",
    description: "Best mix of speed and quality",
  },
  powerful: {
    label: "Powerful",
    description: "Highest quality, slower responses",
  },
};

export interface ResolvedTier {
  provider: AIProviderName;
  model: string;
  apiKey: string;
  displayName: string;
  providerDisplayName: string;
}

/**
 * Resolves a tier to the first candidate whose provider has a configured API key.
 * Returns null if no candidate is available.
 */
export function resolveTier(tier: AITier): ResolvedTier | null {
  const candidates = TIER_CATALOG[tier];

  for (const candidate of candidates) {
    const apiKey = getApiKey(candidate.provider);
    if (apiKey) {
      return {
        provider: candidate.provider,
        model: candidate.model,
        apiKey,
        displayName: candidate.displayName,
        providerDisplayName: candidate.providerDisplayName,
      };
    }
  }

  return null;
}

/**
 * Returns which tiers have at least one configured provider.
 */
export function getAvailableTiers(): AITier[] {
  const tiers: AITier[] = ["fast", "balanced", "powerful"];
  return tiers.filter((tier) => resolveTier(tier) !== null);
}

/**
 * Returns which providers have API keys configured.
 */
export function getConfiguredProviders(): AIProviderName[] {
  const providers: AIProviderName[] = [
    "openai",
    "anthropic",
    "groq",
    "cerebras",
    "gemini",
  ];
  return providers.filter((p) => getApiKey(p) !== null);
}
