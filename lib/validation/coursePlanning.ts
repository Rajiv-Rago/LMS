import { z } from "zod";

export const MAX_COURSE_TOPIC_LENGTH = 500;
export const MAX_COURSE_CONTEXT_LENGTH = 20_000;
// Stored prompts also include a 500-character topic, up to 5,000 characters
// of legacy knowledge profile, duration and fixed planning metadata.
export const MAX_COURSE_SYLLABUS_PROMPT_LENGTH = 30_000;
export const courseTopicSchema = z.string().trim().min(1, "Enter a course topic").max(
  MAX_COURSE_TOPIC_LENGTH,
  "Keep the topic to 500 characters. Put the full description in Details.",
);
export const courseContextSchema = z.string().max(
  MAX_COURSE_CONTEXT_LENGTH,
  "Keep course details to 20,000 characters or fewer.",
);

const coursePlanningSchema = z.object({ topic: courseTopicSchema, context: courseContextSchema });

export function coursePlanningError(topic: string, context: string): string | undefined {
  const result = coursePlanningSchema.safeParse({ topic, context });
  return result.success ? undefined : result.error.issues[0].message;
}
