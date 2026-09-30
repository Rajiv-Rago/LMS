import { AIProviderName, AITier, UserAIPreferences } from "../types";
import { getApiKey } from "./apiKeys";
import { getModelDisplayName, getProviderDisplayName } from "./modelRegistry";
import { resolveTier } from "./tierCatalog";
import { logger } from "@/lib/logger";

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
  const skipped: string[] = [];
  const envModel = process.env.AI_MODEL?.trim() || undefined;

  // 1. Request explicit provider+model — fail fast if user explicitly asked for it
  if (options.requestProvider) {
    const model = options.requestModel?.trim() || undefined;
    const apiKey = getApiKey(options.requestProvider);
    if (!apiKey) {
      logger.error("Provider resolution failed: explicit provider not configured", {
        source: "request-explicit",
        provider: options.requestProvider,
        reason: "API key not configured",
      });
      return null;
    }
    logger.info("Provider resolved", {
      source: "request-explicit",
      provider: options.requestProvider,
      model,
    });
    return {
      provider: options.requestProvider,
      model,
      apiKey,
      ...withDisplayNames(options.requestProvider, model),
    };
  }

  // 2. Request tier (fall through if no candidate has a key)
  if (options.requestTier) {
    const resolved = resolveTier(options.requestTier);
    if (resolved) {
      logger.info("Provider resolved", {
        source: "request-tier",
        provider: resolved.provider,
        model: resolved.model,
      });
      return {
        provider: resolved.provider,
        model: resolved.model,
        apiKey: resolved.apiKey,
        displayName: resolved.displayName,
        providerDisplayName: resolved.providerDisplayName,
      };
    }
    skipped.push(`request-tier:${options.requestTier}`);
  }

  // 3. Course preferences
  if (options.coursePreferences?.defaultProvider) {
    const model = options.coursePreferences.defaultModel?.trim() || undefined;
    const apiKey = getApiKey(options.coursePreferences.defaultProvider);
    if (apiKey) {
      logger.info("Provider resolved", {
        source: "course-prefs",
        provider: options.coursePreferences.defaultProvider,
        model,
      });
      return {
        provider: options.coursePreferences.defaultProvider,
        model,
        apiKey,
        ...withDisplayNames(
          options.coursePreferences.defaultProvider,
          model
        ),
      };
    }
    logger.warn("Provider resolution: skipped", {
      source: "course-prefs",
      provider: options.coursePreferences.defaultProvider,
      reason: "API key not configured",
    });
    skipped.push(`course-prefs:${options.coursePreferences.defaultProvider}`);
  }

  // 4. User preferences (tier takes precedence over explicit provider)
  if (options.userPreferences?.defaultTier) {
    const resolved = resolveTier(options.userPreferences.defaultTier);
    if (resolved) {
      logger.info("Provider resolved", {
        source: "user-prefs-tier",
        provider: resolved.provider,
        model: resolved.model,
      });
      return {
        provider: resolved.provider,
        model: resolved.model,
        apiKey: resolved.apiKey,
        displayName: resolved.displayName,
        providerDisplayName: resolved.providerDisplayName,
      };
    }
    skipped.push(`user-prefs-tier:${options.userPreferences.defaultTier}`);
  }
  if (options.userPreferences?.defaultProvider) {
    const model = options.userPreferences.defaultModel?.trim() || undefined;
    const apiKey = getApiKey(options.userPreferences.defaultProvider);
    if (apiKey) {
      logger.info("Provider resolved", {
        source: "user-prefs-provider",
        provider: options.userPreferences.defaultProvider,
        model,
      });
      return {
        provider: options.userPreferences.defaultProvider,
        model,
        apiKey,
        ...withDisplayNames(
          options.userPreferences.defaultProvider,
          model
        ),
      };
    }
    logger.warn("Provider resolution: skipped", {
      source: "user-prefs-provider",
      provider: options.userPreferences.defaultProvider,
      reason: "API key not configured",
    });
    skipped.push(`user-prefs-provider:${options.userPreferences.defaultProvider}`);
  }

  // 5. Environment variables
  const envProvider = process.env.AI_PROVIDER as AIProviderName | undefined;
  if (envProvider) {
    const apiKey = getApiKey(envProvider);
    if (apiKey) {
      logger.info("Provider resolved", {
        source: "env-var",
        provider: envProvider,
        model: envModel,
      });
      return {
        provider: envProvider,
        model: envModel,
        apiKey,
        ...withDisplayNames(envProvider, envModel),
      };
    }
    logger.warn("Provider resolution: skipped", {
      source: "env-var",
      provider: envProvider,
      reason: "API key not configured",
    });
    skipped.push(`env-var:${envProvider}`);
  }

  // 6. Fallback → openai
  const apiKey = getApiKey("openai");
  if (!apiKey) {
    logger.error("Provider resolution failed: no configured provider", {
      attemptedSources: skipped,
      options: {
        requestProvider: options.requestProvider,
        requestTier: options.requestTier,
        courseProvider: options.coursePreferences?.defaultProvider,
        userTier: options.userPreferences?.defaultTier,
        userProvider: options.userPreferences?.defaultProvider,
        envProvider,
      },
    });
    return null;
  }

  logger.info("Provider resolved", {
    source: "fallback",
    provider: "openai",
    model: envModel,
  });
  return {
    provider: "openai",
    model: envModel,
    apiKey,
    ...withDisplayNames("openai", envModel),
  };
}
