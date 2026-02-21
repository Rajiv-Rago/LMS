import { AIProviderName, AITier, UserAIPreferences } from "../types";
import { resolveTier } from "./tierCatalog";

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
  requestTier?: AITier;
  coursePreferences?: CourseAIPreferences;
  userPreferences?: UserAIPreferences;
}

/**
 * Resolves the AI provider to use based on a 6-level priority chain:
 * 1. Request explicit provider+model (advanced override)
 * 2. Request tier (tier buttons)
 * 3. Course preferences (existing course.aiPreferences)
 * 4. User preferences (user.aiPreferences.defaultTier or defaultProvider)
 * 5. Environment variables (AI_PROVIDER / AI_MODEL)
 * 6. Fallback → openai
 */
export function resolveProvider(
  options: ResolveProviderOptions
): ResolvedProvider | null {
  // 1. Request explicit provider+model
  if (options.requestProvider) {
    const apiKey = getApiKey(options.requestProvider);
    if (!apiKey) return null;
    return {
      provider: options.requestProvider,
      model: options.requestModel,
      apiKey,
    };
  }

  // 2. Request tier
  if (options.requestTier) {
    return resolveTier(options.requestTier);
  }

  // 3. Course preferences
  if (options.coursePreferences?.defaultProvider) {
    const apiKey = getApiKey(options.coursePreferences.defaultProvider);
    if (apiKey) {
      return {
        provider: options.coursePreferences.defaultProvider,
        model: options.coursePreferences.defaultModel,
        apiKey,
      };
    }
  }

  // 4. User preferences (tier takes precedence over explicit provider)
  if (options.userPreferences?.defaultTier) {
    const resolved = resolveTier(options.userPreferences.defaultTier);
    if (resolved) return resolved;
  }
  if (options.userPreferences?.defaultProvider) {
    const apiKey = getApiKey(options.userPreferences.defaultProvider);
    if (apiKey) {
      return {
        provider: options.userPreferences.defaultProvider,
        model: options.userPreferences.defaultModel,
        apiKey,
      };
    }
  }

  // 5. Environment variables
  const envProvider = process.env.AI_PROVIDER as AIProviderName | undefined;
  if (envProvider) {
    const apiKey = getApiKey(envProvider);
    if (apiKey) {
      return {
        provider: envProvider,
        model: process.env.AI_MODEL,
        apiKey,
      };
    }
  }

  // 6. Fallback → openai
  const apiKey = getApiKey("openai");
  if (!apiKey) return null;

  return {
    provider: "openai",
    model: process.env.AI_MODEL,
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
