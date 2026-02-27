import { z } from "zod";
import { aiTierSchema, aiProviderSchema } from "./aiSchemas";

export const youtubePathFormSchema = z
  .object({
    topic: z.string().min(1, "Topic is required").max(500),
    skillLevel: z.enum([
      "complete_beginner",
      "some_basics",
      "intermediate",
      "advanced",
    ]),
    teachingStyle: z.string().max(100).optional(),
    videoLengthPreference: z
      .enum(["short", "medium", "long", "any"])
      .optional(),
    pathVariant: z
      .enum(["fast_track", "standard", "deep_dive"])
      .optional(),
    tier: aiTierSchema.optional(),
    provider: aiProviderSchema.optional(),
    model: z.string().max(256).optional(),
  })
  .refine((data) => !(data.tier && data.provider), {
    message: "Cannot specify both tier and provider",
    path: ["tier"],
  });

export type YouTubePathFormInput = z.infer<typeof youtubePathFormSchema>;
