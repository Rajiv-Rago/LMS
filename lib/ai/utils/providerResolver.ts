import { AIProviderName, AITier, UserAIPreferences } from "../types";
import { getApiKey } from "./apiKeys";
import { getModelDisplayName, getProviderDisplayName } from "./modelRegistry";
import { resolveTier } from "./tierCatalog";

export { API_KEY_ENV_MAP, getApiKey } from "./apiKeys";

export interface CourseAIPreferences {
  defaultProvider?: AIProviderName;
  defaultModel?: string;
}

export interface ResolvedProvider {
  provider: AIProviderName;
  model?: string;
  apiKey: string;
  displayName?: string;
  providerDisplayName?: string;
}

export interface ResolveProviderOptions {
  requestProvider?: AIProviderName;
  requestModel?: string;
  requestTier?: AITier;
  coursePreferences?: CourseAIPreferences;
  userPreferences?: UserAIPreferences;
}

/**
 * Builds display name fields for a resolved provider.
 */
function withDisplayNames(
  provider: AIProviderName,
  model?: string
): { displayName?: string; providerDisplayName: string } {
  return {
    displayName: model ? getModelDisplayName(model) : undefined,
    providerDisplayName: getProviderDisplayName(provider),
  };
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
      ...withDisplayNames(options.requestProvider, options.requestModel),
    };
  }

  // 2. Request tier
  if (options.requestTier) {
    const resolved = resolveTier(options.requestTier);
    if (!resolved) return null;
    return {
      provider: resolved.provider,
      model: resolved.model,
      apiKey: resolved.apiKey,
      displayName: resolved.displayName,
      providerDisplayName: resolved.providerDisplayName,
    };
  }

  // 3. Course preferences
  if (options.coursePreferences?.defaultProvider) {
    const apiKey = getApiKey(options.coursePreferences.defaultProvider);
    if (apiKey) {
      return {
        provider: options.coursePreferences.defaultProvider,
        model: options.coursePreferences.defaultModel,
        apiKey,
        ...withDisplayNames(
          options.coursePreferences.defaultProvider,
          options.coursePreferences.defaultModel
        ),
      };
    }
  }

  // 4. User preferences (tier takes precedence over explicit provider)
  if (options.userPreferences?.defaultTier) {
    const resolved = resolveTier(options.userPreferences.defaultTier);
    if (resolved) {
      return {
        provider: resolved.provider,
        model: resolved.model,
        apiKey: resolved.apiKey,
        displayName: resolved.displayName,
        providerDisplayName: resolved.providerDisplayName,
      };
    }
  }
  if (options.userPreferences?.defaultProvider) {
    const apiKey = getApiKey(options.userPreferences.defaultProvider);
    if (apiKey) {
      return {
        provider: options.userPreferences.defaultProvider,
        model: options.userPreferences.defaultModel,
        apiKey,
        ...withDisplayNames(
          options.userPreferences.defaultProvider,
          options.userPreferences.defaultModel
        ),
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
        ...withDisplayNames(envProvider, process.env.AI_MODEL),
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
    ...withDisplayNames("openai", process.env.AI_MODEL),
  };
}
