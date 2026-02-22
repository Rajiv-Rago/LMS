import { z } from "zod";

/**
 * Schema for AI provider names.
 */
export const aiProviderSchema = z.enum([
  "openai",
  "anthropic",
  "groq",
  "cerebras",
  "gemini",
]);

/**
 * Schema for AI tier names.
 */
export const aiTierSchema = z.enum(["fast", "balanced", "powerful"]);

/**
 * Schema for content generation requests (module or lesson).
 * Supports tier OR provider+model, but not both.
 */
export const generateContentSchema = z
  .object({
    tier: aiTierSchema.optional(),
    provider: aiProviderSchema.optional(),
    model: z.string().max(256).optional(),
  })
  .refine((data) => !(data.tier && data.provider), {
    message: "Cannot specify both tier and provider",
    path: ["tier"],
  });

export type GenerateContentInput = z.infer<typeof generateContentSchema>;

/**
 * Schema for updating user AI preferences.
 */
export const updateAIPreferencesSchema = z
  .object({
    defaultTier: aiTierSchema.nullable().optional(),
    defaultProvider: aiProviderSchema.nullable().optional(),
    defaultModel: z.string().max(256).nullable().optional(),
  })
  .refine((data) => !(data.defaultTier && data.defaultProvider), {
    message: "Cannot specify both defaultTier and defaultProvider",
    path: ["defaultTier"],
  });

export type UpdateAIPreferencesInput = z.infer<
  typeof updateAIPreferencesSchema
>;
