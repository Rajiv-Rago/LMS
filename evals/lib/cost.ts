import type { UsageRecord, CostRecord } from "./types";

interface Price {
  promptPerMTok: number;
  completionPerMTok: number;
}

const PRICES: Record<string, Price> = {
  // OpenAI
  "openai:gpt-4o": { promptPerMTok: 2.5, completionPerMTok: 10 },
  "openai:gpt-4o-mini": { promptPerMTok: 0.15, completionPerMTok: 0.6 },
  "openai:gpt-4.1": { promptPerMTok: 2.0, completionPerMTok: 8.0 },
  "openai:gpt-4.1-mini": { promptPerMTok: 0.4, completionPerMTok: 1.6 },
  "openai:gpt-4.1-nano": { promptPerMTok: 0.1, completionPerMTok: 0.4 },
  // Anthropic
  "anthropic:claude-sonnet-4-6": { promptPerMTok: 3.0, completionPerMTok: 15.0 },
  "anthropic:claude-sonnet-4-5": { promptPerMTok: 3.0, completionPerMTok: 15.0 },
  "anthropic:claude-haiku-4-5": { promptPerMTok: 1.0, completionPerMTok: 5.0 },
  "anthropic:claude-opus-4-7": { promptPerMTok: 15.0, completionPerMTok: 75.0 },
  // Gemini
  "gemini:gemini-2.5-pro": { promptPerMTok: 1.25, completionPerMTok: 10.0 },
  "gemini:gemini-2.5-flash": { promptPerMTok: 0.075, completionPerMTok: 0.3 },
  "gemini:gemini-2.0-flash": { promptPerMTok: 0.075, completionPerMTok: 0.3 },
  // Cerebras
  "cerebras:llama-3.3-70b": { promptPerMTok: 0.85, completionPerMTok: 1.2 },
  "cerebras:llama-4-scout-17b-16e-instruct": { promptPerMTok: 0.65, completionPerMTok: 0.85 },
  // Groq (judge)
  "groq:openai/gpt-oss-120b": { promptPerMTok: 0.15, completionPerMTok: 0.75 },
  "groq:llama-3.1-8b-instant": { promptPerMTok: 0.05, completionPerMTok: 0.08 },
  "groq:llama-3.3-70b-versatile": { promptPerMTok: 0.59, completionPerMTok: 0.79 },
};

const DEFAULT_PRICE: Price = { promptPerMTok: 1.0, completionPerMTok: 3.0 };

export function priceKey(provider: string, model?: string): string {
  return `${provider}:${model ?? "default"}`;
}

export function lookupPrice(provider: string, model?: string): Price {
  const key = priceKey(provider, model);
  return PRICES[key] ?? DEFAULT_PRICE;
}

export function computeCost(
  provider: string,
  model: string | undefined,
  usage: UsageRecord | undefined
): CostRecord | undefined {
  if (!usage) return undefined;
  const price = lookupPrice(provider, model);
  const promptUsd = (usage.promptTokens / 1_000_000) * price.promptPerMTok;
  const completionUsd = (usage.completionTokens / 1_000_000) * price.completionPerMTok;
  return {
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    promptUsd,
    completionUsd,
    totalUsd: promptUsd + completionUsd,
  };
}

export function formatUsd(amount: number): string {
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
