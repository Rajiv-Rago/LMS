import { z } from "zod";
import { aiSelectionSchema } from "@/lib/validation/aiSchemas";
import { courseTopicSchema, courseContextSchema } from "@/lib/validation/coursePlanning";

export const ASSESSMENT_DRAFT_KEY = "kantigo-assessment-draft:v1";
// Validate browser storage before restoring a dashboard configuration.
export const assessmentDraftSchema = z.object({
  version: z.literal(1),
  expiresAt: z.number().refine(value => value > Date.now()),
  config: z.object({
    topic: courseTopicSchema,
    complexity: z.enum(["foundations", "standard", "deep"]),
    passingScore: z.number().int().min(0).max(100),
    additionalContext: courseContextSchema,
    aiSelection: aiSelectionSchema.optional(),
  }),
});
