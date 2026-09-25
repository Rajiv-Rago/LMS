export type TargetLevel = "beginner" | "intermediate" | "advanced";

/** Complexity labels shown in the dashboard. Aliases for TargetLevel for now. */
export type Complexity = "foundations" | "standard" | "deep";

export const COMPLEXITY_TO_LEVEL: Record<Complexity, TargetLevel> = {
  foundations: "beginner",
  standard: "intermediate",
  deep: "advanced",
};

export const LEVEL_TO_COMPLEXITY: Record<TargetLevel, Complexity> = {
  beginner: "foundations",
  intermediate: "standard",
  advanced: "deep",
};

export function complexityToLevel(complexity: Complexity | TargetLevel): TargetLevel {
  if (complexity === "beginner" || complexity === "intermediate" || complexity === "advanced") {
    return complexity;
  }
  return COMPLEXITY_TO_LEVEL[complexity as Complexity] ?? "intermediate";
}

export function levelToComplexity(level: TargetLevel | Complexity): Complexity {
  if (level === "foundations" || level === "standard" || level === "deep") {
    return level;
  }
  return LEVEL_TO_COMPLEXITY[level as TargetLevel] ?? "standard";
}

export function normalizeComplexity(input?: string): Complexity {
  if (!input) return "standard";
  const v = input.toLowerCase().trim();
  if (v === "foundations" || v === "beginner") return "foundations";
  if (v === "deep" || v === "advanced") return "deep";
  return "standard";
}

/** Maps complexity to lesson-content depth tier. */
export function complexityToTier(complexity: Complexity | TargetLevel): "concise" | "balanced" | "thorough" {
  const normalized = normalizeComplexity(complexity);
  if (normalized === "foundations") return "concise";
  if (normalized === "deep") return "thorough";
  return "balanced";
}

/**
 * Extracts the target level from a syllabus prompt string.
 * Looks for patterns like "Level: beginner" or "Complexity: deep" in the prompt.
 *
 * @param syllabusPrompt - The syllabus prompt string to parse
 * @returns The extracted target level, defaults to "intermediate"
 */
export function extractTargetLevel(syllabusPrompt?: string): TargetLevel {
  if (!syllabusPrompt) return "intermediate";

  const lowerPrompt = syllabusPrompt.toLowerCase();

  if (lowerPrompt.includes("level: beginner") || lowerPrompt.includes("complexity: foundations")) return "beginner";
  if (lowerPrompt.includes("level: advanced") || lowerPrompt.includes("complexity: deep")) return "advanced";

  return "intermediate";
}

/**
 * Extracts the complexity label from a syllabus prompt string.
 * Defaults to "standard".
 */
export function extractComplexity(syllabusPrompt?: string): Complexity {
  return levelToComplexity(extractTargetLevel(syllabusPrompt));
}
