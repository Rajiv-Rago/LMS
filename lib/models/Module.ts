import mongoose, { Document, Model } from "mongoose";
import { AIProviderName } from "@/lib/ai/types";

export type ModuleContentStatus = "skeleton" | "generating" | "completed" | "failed";

export interface GenerationConfig {
  provider: AIProviderName;
  model?: string;
}

export interface IModule extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  course: mongoose.Types.ObjectId;
  lessons: mongoose.Types.ObjectId[];
  order: number;
  isPublished: boolean;
  contentStatus?: ModuleContentStatus;
  generationConfig?: GenerationConfig;
  createdAt: Date;
  updatedAt: Date;
}

type ModuleModel = Model<IModule>;

const moduleSchema = new mongoose.Schema<IModule, ModuleModel>(
  {
    title: {
      type: String,
      required: [true, "Module title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course is required"],
    },
    lessons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lesson",
      },
    ],
    order: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    contentStatus: {
      type: String,
      enum: {
        values: ["skeleton", "generating", "completed", "failed"],
        message: "Content status must be skeleton, generating, completed, or failed",
      },
    },
    generationConfig: {
      provider: {
        type: String,
        enum: ["openai", "anthropic", "cerebras", "gemini"],
      },
      model: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

moduleSchema.index({ course: 1, order: 1 });

const Module =
  (mongoose.models.Module as ModuleModel) ||
  mongoose.model<IModule, ModuleModel>("Module", moduleSchema);

export default Module;
