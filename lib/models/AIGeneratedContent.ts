import mongoose, { Document, Model } from "mongoose";

export type ContentType = "quiz" | "summary" | "practice" | "flashcards";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface IAIGeneratedContent extends Document {
  _id: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  lesson?: mongoose.Types.ObjectId;
  generatedBy: mongoose.Types.ObjectId;
  contentType: ContentType;
  title: string;
  content: string;
  quizQuestions?: QuizQuestion[];
  provider: "openai" | "anthropic";
  aiModel?: string;
  prompt?: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

type AIGeneratedContentModel = Model<IAIGeneratedContent>;

const quizQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    options: [
      {
        type: String,
        required: true,
      },
    ],
    correctAnswer: {
      type: Number,
      required: true,
    },
    explanation: {
      type: String,
    },
  },
  { _id: false }
);

const aiGeneratedContentSchema = new mongoose.Schema<
  IAIGeneratedContent,
  AIGeneratedContentModel
>(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course is required"],
    },
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Generator is required"],
    },
    contentType: {
      type: String,
      enum: {
        values: ["quiz", "summary", "practice", "flashcards"],
        message: "Content type must be quiz, summary, practice, or flashcards",
      },
      required: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    content: {
      type: String,
      required: [true, "Content is required"],
    },
    quizQuestions: [quizQuestionSchema],
    provider: {
      type: String,
      enum: ["openai", "anthropic"],
      required: true,
    },
    aiModel: {
      type: String,
    },
    prompt: {
      type: String,
    },
    approvalStatus: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected"],
        message: "Status must be pending, approved, or rejected",
      },
      default: "pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      maxlength: [1000, "Rejection reason cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
  }
);

aiGeneratedContentSchema.index({ course: 1, contentType: 1 });
aiGeneratedContentSchema.index({ lesson: 1 });
aiGeneratedContentSchema.index({ approvalStatus: 1 });
aiGeneratedContentSchema.index({ generatedBy: 1 });

const AIGeneratedContent =
  (mongoose.models.AIGeneratedContent as AIGeneratedContentModel) ||
  mongoose.model<IAIGeneratedContent, AIGeneratedContentModel>(
    "AIGeneratedContent",
    aiGeneratedContentSchema
  );

export default AIGeneratedContent;
