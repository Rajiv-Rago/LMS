import { AIGenerationLog } from "@/lib/models";
import { AIProviderName } from "@/lib/ai/types";
import { TokenUsage } from "@/lib/models/AIGenerationLog";

export type GenerationType = "syllabus" | "module_content" | "lesson_content";
export type GenerationStatus = "pending" | "completed" | "failed";

export interface LogAIGenerationParams {
  user: string;
  course: string;
  module?: string;
  lesson?: string;
  generationType: GenerationType;
  provider: AIProviderName;
  model: string;
  prompt: string;
  response?: string;
  tokenUsage?: TokenUsage;
  status: GenerationStatus;
  error?: string;
  durationMs?: number;
}

/**
 * Creates an AI generation log entry.
 * Centralizes logging logic to reduce duplication across route handlers.
 */
export async function logAIGeneration(
  params: LogAIGenerationParams
): Promise<void> {
  await AIGenerationLog.create({
    user: params.user,
    course: params.course,
    module: params.module,
    lesson: params.lesson,
    generationType: params.generationType,
    provider: params.provider,
    aiModel: params.model,
    prompt: params.prompt,
    response: params.response,
    tokenUsage: params.tokenUsage,
    status: params.status,
    error: params.error,
    durationMs: params.durationMs,
  });
}
