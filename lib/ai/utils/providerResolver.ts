import { AIProviderName } from "../types";

export const API_KEY_ENV_MAP: Record<AIProviderName, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  gemini: "GEMINI_API_KEY",
};

export interface CourseAIPreferences {
  defaultProvider?: AIProviderName;
  defaultModel?: string;
}

export interface ResolvedProvider {
  provider: AIProviderName;
  model?: string;
  apiKey: string;
}

export interface ResolveProviderOptions {
  requestProvider?: AIProviderName;
  requestModel?: string;
  coursePreferences?: CourseAIPreferences;
}

/**
 * Resolves the AI provider to use based on request, course preferences, and environment.
 * Priority order:
 * 1. Request provider/model
 * 2. Course preferences
 * 3. Environment variables
 * 4. Default to OpenAI
 */
export function resolveProvider(
  options: ResolveProviderOptions
): ResolvedProvider | null {
  const provider =
    options.requestProvider ||
    options.coursePreferences?.defaultProvider ||
    (process.env.AI_PROVIDER as AIProviderName) ||
    "openai";

  const model =
    options.requestModel ||
    options.coursePreferences?.defaultModel ||
    process.env.AI_MODEL;

  const apiKey = getApiKey(provider);

  if (!apiKey) {
    return null;
  }

  return {
    provider,
    model,
    apiKey,
  };
}

/**
 * Gets the API key for a given provider from environment variables.
 * Returns null if not configured.
 */
export function getApiKey(provider: AIProviderName): string | null {
  const envVar = API_KEY_ENV_MAP[provider];
  const apiKey = process.env[envVar];
  return apiKey || null;
}
