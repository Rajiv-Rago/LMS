import { AIProviderName, AITier } from "../types";

export interface ModelInfo {
  id: string;
  displayName: string;
  provider: AIProviderName;
  tiers: AITier[];
}

/**
 * Central registry of all known models across providers.
 * Each entry maps an API model ID to a human-friendly display name and tier membership.
 */
export const MODEL_REGISTRY: ModelInfo[] = [
  // OpenAI
  { id: "gpt-4.1-nano-2025-04-14", displayName: "GPT 4.1 Nano", provider: "openai", tiers: ["concise"] },
  { id: "gpt-4.1-mini-2025-04-14", displayName: "GPT 4.1 Mini", provider: "openai", tiers: ["balanced"] },
  { id: "gpt-4.1-2025-04-14", displayName: "GPT 4.1", provider: "openai", tiers: ["thorough"] },

  // Anthropic
  { id: "claude-haiku-4-5-20251001", displayName: "Claude 3.5 Haiku", provider: "anthropic", tiers: ["concise"] },
  { id: "claude-sonnet-4-20250514", displayName: "Claude Sonnet 4", provider: "anthropic", tiers: ["balanced"] },
  { id: "claude-opus-4-20250514", displayName: "Claude Opus 4", provider: "anthropic", tiers: ["thorough"] },

  // Gemini
  { id: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", provider: "gemini", tiers: ["concise"] },
  { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", provider: "gemini", tiers: ["balanced", "thorough"] },

  // Groq
  { id: "llama-3.3-70b-versatile", displayName: "Llama 3.3 70B", provider: "groq", tiers: ["concise"] },

  // Cerebras
  { id: "llama-3.3-70b", displayName: "Llama 3.3 70B", provider: "cerebras", tiers: ["concise"] },
];

const modelById = new Map<string, ModelInfo>();
for (const model of MODEL_REGISTRY) {
  modelById.set(model.id, model);
}

/**
 * Look up full model info by API model ID. Returns undefined if not in registry.
 */
export function getModelInfo(id: string): ModelInfo | undefined {
  return modelById.get(id);
}

/**
 * Returns the human-friendly display name for a model ID.
 * Falls back to the raw ID if not found in the registry.
 */
export function getModelDisplayName(id: string): string {
  return modelById.get(id)?.displayName ?? id;
}

const PROVIDER_DISPLAY_NAMES: Record<AIProviderName, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  groq: "Groq",
  cerebras: "Cerebras",
};

/**
 * Returns a human-friendly provider name (e.g. "OpenAI" instead of "openai").
 */
export function getProviderDisplayName(provider: AIProviderName): string {
  return PROVIDER_DISPLAY_NAMES[provider] ?? provider;
}

/**
 * Returns all registry models that participate in the given tier.
 */
export function getModelsForTier(tier: AITier): ModelInfo[] {
  return MODEL_REGISTRY.filter((m) => m.tiers.includes(tier));
}
