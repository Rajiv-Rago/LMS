import { z } from "zod";
import { aiSelectionSchema } from "@/lib/validation/aiSchemas";
import { courseContextSchema, courseTopicSchema } from "@/lib/validation/coursePlanning";
import { learnerProfileSchema, MAX_INTAKE_QUESTIONS, MAX_INTAKE_ROUNDS } from "./profile";

export const MAX_QUESTIONS_PER_ROUND = 3;
export const questionSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  options: z.array(z.string().trim().min(1).max(500)).length(4)
    .refine(options => new Set(options.map(s => s.toLowerCase())).size === 4, "Options must be distinct"),
  correctIndex: z.number().int().min(0).max(3),
  topic: z.string().trim().min(1).max(200),
});
const topics = z.array(z.string().trim().min(1).max(200)).max(5);
export const decisionSchema = z.object({
  sufficient: z.boolean(),
  confidence: z.number().min(0).max(1),
  knowledge_gaps: topics,
  strengths: topics,
  next_question_focus: z.string().trim().max(1000),
  starting_level: z.enum(["beginner", "intermediate", "advanced"]),
  prerequisite_coverage: topics,
  uncertainties: z.array(z.string().trim().min(1).max(300)).max(5),
}).refine(d => d.sufficient || d.next_question_focus.length > 0, "A follow-up needs a focus");
export const completionReasons = ["sufficient", "max_rounds", "question_budget", "diminishing_gain", "skipped", "error", "timeout"] as const;
export const sessionSchema = z.object({
  userId: z.string(),
  expiresAt: z.number(),
  topic: courseTopicSchema,
  context: courseContextSchema,
  aiSelection: aiSelectionSchema.optional(),
  phase: z.enum(["goals", "knowledge", "summary"]),
  round: z.number().int().min(0).max(MAX_INTAKE_ROUNDS),
  completedRounds: z.number().int().min(0).max(MAX_INTAKE_ROUNDS),
  questionCount: z.number().int().min(0).max(MAX_INTAKE_QUESTIONS),
  maxRounds: z.number().int().min(1).max(MAX_INTAKE_ROUNDS),
  goalOptions: z.array(z.string().max(300)).max(6),
  profile: learnerProfileSchema.optional(),
  observations: z.array(z.object({ topic: z.string().max(200), correct: z.boolean().nullable() })).max(MAX_INTAKE_QUESTIONS),
  questions: z.array(questionSchema).max(MAX_QUESTIONS_PER_ROUND),
  history: z.array(z.object({
    ...questionSchema.shape,
    answer: z.number().int().min(-1).max(3).optional(),
    explanation: z.string().max(1000).optional(),
  })).max(MAX_INTAKE_QUESTIONS),
  decision: decisionSchema.optional(),
  lowGainRounds: z.number().int().min(0).max(MAX_INTAKE_ROUNDS),
  completionReason: z.enum(completionReasons).optional(),
});
export type IntakeSession = z.infer<typeof sessionSchema>;
export type AssessmentDecision = z.infer<typeof decisionSchema>;
