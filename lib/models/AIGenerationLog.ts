import mongoose, { Document, Model } from "mongoose";
import { AIProviderName } from "@/lib/ai/types";

export type GenerationType = "syllabus" | "module_content" | "lesson_content";
export type GenerationStatus = "pending" | "completed" | "failed";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface IAIGenerationLog extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  module?: mongoose.Types.ObjectId;
  lesson?: mongoose.Types.ObjectId;
  generationType: GenerationType;
  provider: AIProviderName;
  aiModel: string;
  prompt: string;
  response?: string;
  tokenUsage?: TokenUsage;
  status: GenerationStatus;
  error?: string;
  durationMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

type AIGenerationLogModel = Model<IAIGenerationLog>;

const tokenUsageSchema = new mongoose.Schema(
  {
    promptTokens: {
      type: Number,
      required: true,
    },
    completionTokens: {
      type: Number,
      required: true,
    },
    totalTokens: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const aiGenerationLogSchema = new mongoose.Schema<
  IAIGenerationLog,
  AIGenerationLogModel
>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course is required"],
    },
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
    },
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
    },
    generationType: {
      type: String,
      enum: {
        values: ["syllabus", "module_content", "lesson_content"],
        message: "Generation type must be syllabus, module_content, or lesson_content",
      },
      required: [true, "Generation type is required"],
    },
    provider: {
      type: String,
      enum: ["openai", "anthropic", "groq", "cerebras", "gemini"],
      required: [true, "Provider is required"],
    },
    aiModel: {
      type: String,
      required: [true, "Model is required"],
    },
    prompt: {
      type: String,
      required: [true, "Prompt is required"],
    },
    response: {
      type: String,
    },
    tokenUsage: tokenUsageSchema,
    status: {
      type: String,
      enum: {
        values: ["pending", "completed", "failed"],
        message: "Status must be pending, completed, or failed",
      },
      default: "pending",
    },
    error: {
      type: String,
    },
    durationMs: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

aiGenerationLogSchema.index({ user: 1, createdAt: -1 });
aiGenerationLogSchema.index({ course: 1 });
aiGenerationLogSchema.index({ generationType: 1 });
aiGenerationLogSchema.index({ status: 1 });

const AIGenerationLog =
  (mongoose.models.AIGenerationLog as AIGenerationLogModel) ||
  mongoose.model<IAIGenerationLog, AIGenerationLogModel>(
    "AIGenerationLog",
    aiGenerationLogSchema
  );

export default AIGenerationLog;
