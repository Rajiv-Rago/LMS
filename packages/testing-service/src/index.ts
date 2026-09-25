import { z } from "zod";

export const DiagnosticSchema = z.object({
  multipleChoice: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctIndex: z.number(),
      userAnswer: z.number().optional(),
    })
  ),
  essays: z.array(z.object({
    prompt: z.string(),
    response: z.string(),
    depthScore: z.number().optional(),
  })),
});

export interface DiagnosticMcq {
  question: string;
  options: string[];
  correctIndex: number;
  topic?: string;
  userAnswer?: number;
}

export interface DiagnosticEssay {
  prompt: string;
  response: string;
  depthScore?: number; // 0-100 gauge of knowledge depth
}

export interface KnowledgeProfile {
  mcqScore: number; // 0-100
  essayScores: number[];
  weakTopics: string[];
  strongTopics: string[];
  depthLevel: "shallow" | "developing" | "solid" | "deep";
  summary: string;
}

export interface AdaptiveDiagnosticState {
  topic: string;
  complexity: string;
  round: number; // 1-based count of agentic iterations used
  maxIterations: number;
  mcqs: DiagnosticMcq[];
  essays: DiagnosticEssay[];
  weakTopics: string[];
}

export function getMaxDiagnosticIterations(envValue?: string | number): number {
  if (typeof envValue === "number" && Number.isFinite(envValue) && envValue > 0) {
    return Math.floor(envValue);
  }
  if (typeof envValue === "string") {
    const n = parseInt(envValue, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 5;
}

export function shouldContinueDiagnostic(state: AdaptiveDiagnosticState): boolean {
  return state.round < state.maxIterations;
}

export function scoreMcqs(mcqs: DiagnosticMcq[]): number {
  const answered = mcqs.filter((m) => typeof m.userAnswer === "number");
  if (answered.length === 0) return 0;
  const correct = answered.filter((m) => m.userAnswer === m.correctIndex).length;
  return Math.round((correct / answered.length) * 100);
}

export function deriveWeakTopics(mcqs: DiagnosticMcq[]): string[] {
  return mcqs
    .filter((m) => typeof m.userAnswer === "number" && m.userAnswer !== m.correctIndex)
    .map((m) => m.topic || m.question.slice(0, 80))
    .slice(0, 10);
}

export function buildKnowledgeProfileSummary(args: {
  topic: string;
  mcqScore: number;
  essayScores: number[];
  weakTopics: string[];
}): KnowledgeProfile {
  const { topic, mcqScore, essayScores, weakTopics } = args;
  const avgEssay = essayScores.length
    ? essayScores.reduce((a, b) => a + b, 0) / essayScores.length
    : 0;
  const combined = Math.round(mcqScore * 0.6 + avgEssay * 0.4);
  const depthLevel =
    combined >= 80 ? "deep" : combined >= 60 ? "solid" : combined >= 40 ? "developing" : "shallow";
  const strongTopics: string[] = [];
  const summary =
    `Diagnostic for "${topic}": MCQ ${mcqScore}%, ` +
    `essay depth ${essayScores.length ? Math.round(avgEssay) + "%" : "n/a"} (${depthLevel}). ` +
    (weakTopics.length ? `Gaps: ${weakTopics.join("; ")}. ` : "No major gaps detected. ") +
    `Emphasize gaps in the syllabus; skip what the learner already knows.`;
  return { mcqScore, essayScores, weakTopics, strongTopics, depthLevel, summary };
}

export function buildKnowledgeProfilePrompt(profile: KnowledgeProfile): string {
  return (
    `MCQ score: ${profile.mcqScore}% (${profile.depthLevel} depth). ` +
    `Essay scores: ${profile.essayScores.join(", ") || "none"}. ` +
    (profile.weakTopics.length ? `Known gaps: ${profile.weakTopics.join("; ")}. ` : "") +
    profile.summary
  );
}

export class TestingService {
  async runInitialDiagnostic(context: {
    provider: string;
    model?: string;
    topic: string;
  }): Promise<{
    mcqScore: number;
    essayScores: number[];
    rules: { passingScore: number; description: string; outcomes: string[]; proposedCurriculum: string[] };
  }> {
    return {
      mcqScore: 0,
      essayScores: [],
      rules: {
        passingScore: 50,
        description: "",
        outcomes: [],
        proposedCurriculum: [],
      },
    };
  }

  async runModuleRetest(lessonName: string, score: number, passingScore = 70) {
    if (score < passingScore) {
      return { action: "redo-lesson", supplementary: false };
    }
    return { action: "pass", supplementary: false };
  }

  /** Pure adaptive-loop helper: reviews one round (3 MCQs + optional essay) and decides whether to continue. */
  reviewRound(state: AdaptiveDiagnosticState, essayDepthScore?: number): {
    mcqScore: number;
    weakTopics: string[];
    done: boolean;
    profile: KnowledgeProfile;
  } {
    const mcqScore = scoreMcqs(state.mcqs);
    const weakTopics = deriveWeakTopics(state.mcqs);
    const essayScores = state.essays
      .map((e) => e.depthScore)
      .filter((s): s is number => typeof s === "number");
    if (typeof essayDepthScore === "number") essayScores.push(essayDepthScore);
    const profile = buildKnowledgeProfileSummary({
      topic: state.topic,
      mcqScore,
      essayScores,
      weakTopics,
    });
    const done = !shouldContinueDiagnostic(state);
    return { mcqScore, weakTopics, done, profile };
  }
}
