import { z } from "zod";

export const MAX_INTAKE_ROUNDS = 3;
export const MAX_INTAKE_QUESTIONS = 8;
export const BROAD_GOAL = "Give me a broad introduction / help me choose";
export const EXPERIENCE_OPTIONS = [
  "beginner",
  "intermediate",
  "advanced",
  "unsure",
] as const;
export const learnerProfileSchema = z.object({
  goals: z.array(z.string().trim().min(1).max(500)).min(1).max(3),
  startingLevel: z.enum(["beginner", "intermediate", "advanced"]),
  selfReportedLevel: z.enum(EXPERIENCE_OPTIONS),
  observedStrengths: z.array(z.string().max(200)).max(5),
  observedGaps: z.array(z.string().max(200)).max(5),
  assumptions: z.array(z.string().max(300)).max(5),
  explanation: z.string().max(1000).optional(),
  assessmentSkipped: z.boolean(),
});
export type LearnerProfile = z.infer<typeof learnerProfileSchema>;

export interface Observation {
  topic: string;
  correct: boolean | null;
}

export function buildLearnerProfile(
  goals: string[],
  selfReportedLevel: LearnerProfile["selfReportedLevel"],
  observations: Observation[] = [],
  explanation?: string,
): LearnerProfile {
  const correct = observations.filter((o) => o.correct === true).length;
  let startingLevel: LearnerProfile["startingLevel"] =
    selfReportedLevel === "unsure" ? "beginner" : selfReportedLevel;
  if (observations.length) {
    startingLevel =
      correct >= Math.ceil(observations.length / 2)
        ? "intermediate"
        : "beginner";
    if (correct === observations.length && selfReportedLevel === "advanced") {
      startingLevel = "advanced";
    }
  }
  return {
    goals,
    startingLevel,
    selfReportedLevel,
    observedStrengths: [
      ...new Set(
        observations.filter((o) => o.correct === true).map((o) => o.topic),
      ),
    ].slice(0, 5),
    observedGaps: [
      ...new Set(
        observations.filter((o) => o.correct !== true).map((o) => o.topic),
      ),
    ].slice(0, 5),
    assumptions: [
      observations.length
        ? "Starting level is a rough estimate from a small sample; retain prerequisite refreshers."
        : "Knowledge check skipped; starting level uses self-report or beginner defaults.",
      ...(goals.includes(BROAD_GOAL)
        ? ["Use a balanced introduction and offer ways to specialize later."]
        : []),
    ],
    explanation: explanation?.trim() || undefined,
    assessmentSkipped: !observations.length,
  };
}

// Follow up only when mixed evidence could change prerequisite coverage. Beginners
// and consistently correct/unknown answers already provide enough direction.
export function needsClarification(
  level: LearnerProfile["selfReportedLevel"],
  observations: Observation[],
): boolean {
  return (
    level !== "beginner" &&
    observations.some((o) => o.correct === true) &&
    observations.some((o) => o.correct !== true)
  );
}
