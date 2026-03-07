import mongoose, { Document, Model } from "mongoose";
import { AIProviderName } from "@/lib/ai/types";

export type LessonContentType = "text" | "video" | "file";
export type LessonGenerationStatus = "skeleton" | "generating" | "completed" | "failed";

export interface LessonGenerationConfig {
  provider: AIProviderName;
  model?: string;
}

export interface ILesson extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  module: mongoose.Types.ObjectId;
  contentType: LessonContentType;
  content: string;
  videoUrl?: string;
  fileUrl?: string;
  duration?: number;
  order: number;
  isPublished: boolean;
  aiContext?: string;
  generationStatus?: LessonGenerationStatus;
  lessonOutline?: string;
  generationConfig?: LessonGenerationConfig;
  previousContent?: string;
  previousKeyTakeaways?: string[];
  keyTakeaways?: string[];
  youtubeMetadata?: {
    videoId: string;
    channelName: string;
    channelId: string;
    thumbnailUrl: string;
    viewCount?: number;
    publishedAt?: Date;
    videoDuration?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

type LessonModel = Model<ILesson>;

const lessonSchema = new mongoose.Schema<ILesson, LessonModel>(
  {
    title: {
      type: String,
      required: [true, "Lesson title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      required: [true, "Module is required"],
    },
    contentType: {
      type: String,
      enum: {
        values: ["text", "video", "file"],
        message: "Content type must be text, video, or file",
      },
      default: "text",
    },
    content: {
      type: String,
      default: "",
    },
    videoUrl: {
      type: String,
    },
    fileUrl: {
      type: String,
    },
    duration: {
      type: Number,
      min: 0,
    },
    order: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    aiContext: {
      type: String,
      maxlength: [10000, "AI context cannot exceed 10000 characters"],
    },
    generationStatus: {
      type: String,
      enum: {
        values: ["skeleton", "generating", "completed", "failed"],
        message: "Generation status must be skeleton, generating, completed, or failed",
      },
    },
    lessonOutline: {
      type: String,
      maxlength: [2000, "Lesson outline cannot exceed 2000 characters"],
    },
    generationConfig: {
      provider: {
        type: String,
        enum: ["openai", "anthropic", "groq", "cerebras", "gemini"],
      },
      model: {
        type: String,
      },
    },
    previousContent: {
      type: String,
    },
    previousKeyTakeaways: [{
      type: String,
      maxlength: [500, "Key takeaway cannot exceed 500 characters"],
    }],
    keyTakeaways: [{
      type: String,
      maxlength: [500, "Key takeaway cannot exceed 500 characters"],
    }],
    youtubeMetadata: {
      videoId: { type: String },
      channelName: { type: String },
      channelId: { type: String },
      thumbnailUrl: { type: String },
      viewCount: { type: Number },
      publishedAt: { type: Date },
      videoDuration: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

lessonSchema.index({ module: 1, order: 1 });

const Lesson =
  (mongoose.models.Lesson as LessonModel) ||
  mongoose.model<ILesson, LessonModel>("Lesson", lessonSchema);

export default Lesson;
