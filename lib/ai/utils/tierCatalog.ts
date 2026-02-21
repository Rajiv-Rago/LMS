import { AIProviderName } from "../types";
import { getApiKey } from "./providerResolver";

export type AITier = "fast" | "balanced" | "powerful";

export interface TierCandidate {
  provider: AIProviderName;
  model: string;
}

export interface TierMetadata {
  label: string;
  description: string;
}

export const TIER_CATALOG: Record<AITier, TierCandidate[]> = {
  fast: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "cerebras", model: "llama-3.3-70b" },
    { provider: "gemini", model: "gemini-1.5-flash" },
    { provider: "openai", model: "gpt-4o-mini" },
    { provider: "anthropic", model: "claude-3-haiku-20240307" },
  ],
  balanced: [
    { provider: "openai", model: "gpt-4o" },
    { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
    { provider: "gemini", model: "gemini-1.5-pro" },
    { provider: "groq", model: "llama-3.3-70b-versatile" },
  ],
  powerful: [
    { provider: "anthropic", model: "claude-3-opus-20240229" },
    { provider: "openai", model: "gpt-4o" },
    { provider: "gemini", model: "gemini-1.5-pro" },
  ],
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

/**
 * Resolves a tier to the first candidate whose provider has a configured API key.
 * Returns null if no candidate is available.
 */
export function resolveTier(
  tier: AITier
): { provider: AIProviderName; model: string; apiKey: string } | null {
  const candidates = TIER_CATALOG[tier];

  for (const candidate of candidates) {
    const apiKey = getApiKey(candidate.provider);
    if (apiKey) {
      return {
        provider: candidate.provider,
        model: candidate.model,
        apiKey,
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
