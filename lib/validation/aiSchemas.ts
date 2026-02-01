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
 * Schema for content generation requests (module or lesson).
 */
export const generateContentSchema = z.object({
  provider: aiProviderSchema.optional(),
  model: z.string().optional(),
});

export type GenerateContentInput = z.infer<typeof generateContentSchema>;
