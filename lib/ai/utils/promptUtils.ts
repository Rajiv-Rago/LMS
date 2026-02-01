export type TargetLevel = "beginner" | "intermediate" | "advanced";

/**
 * Extracts the target level from a syllabus prompt string.
 * Looks for patterns like "Level: beginner" in the prompt.
 *
 * @param syllabusPrompt - The syllabus prompt string to parse
 * @returns The extracted target level, defaults to "intermediate"
 */
export function extractTargetLevel(syllabusPrompt?: string): TargetLevel {
  if (!syllabusPrompt) return "intermediate";

  const lowerPrompt = syllabusPrompt.toLowerCase();

  if (lowerPrompt.includes("level: beginner")) return "beginner";
  if (lowerPrompt.includes("level: advanced")) return "advanced";

  return "intermediate";
}
