// Streaming lesson requests have a 120-second runtime limit. Allow a grace
// period, then treat an abandoned database flag as retryable.
export const LESSON_GENERATION_LEASE_MS = 180_000;

export function isLessonGenerationActive(lesson: {
  generationStatus?: string;
  updatedAt?: Date | string;
}, now = Date.now()): boolean {
  if (lesson.generationStatus !== "generating") return false;
  // Be conservative for legacy records without a timestamp.
  if (!lesson.updatedAt) return true;
  return now - new Date(lesson.updatedAt).getTime() < LESSON_GENERATION_LEASE_MS;
}

export function availableLessonGenerationFilter(now = Date.now()) {
  return {
    $or: [
      { generationStatus: { $ne: "generating" } },
      { updatedAt: { $lte: new Date(now - LESSON_GENERATION_LEASE_MS) } },
    ],
  };
}
