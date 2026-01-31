import mongoose, { Document, Model } from "mongoose";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface IAIChatSession extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  lesson?: mongoose.Types.ObjectId;
  title: string;
  messages: AIMessage[];
  provider: "openai" | "anthropic";
  aiModel?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type AIChatSessionModel = Model<IAIChatSession>;

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const aiChatSessionSchema = new mongoose.Schema<
  IAIChatSession,
  AIChatSessionModel
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
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
    },
    title: {
      type: String,
      default: "New Chat",
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    messages: [messageSchema],
    provider: {
      type: String,
      enum: ["openai", "anthropic"],
      required: true,
    },
    aiModel: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

aiChatSessionSchema.index({ user: 1, course: 1 });
aiChatSessionSchema.index({ user: 1, isActive: 1 });
aiChatSessionSchema.index({ createdAt: -1 });

const AIChatSession =
  (mongoose.models.AIChatSession as AIChatSessionModel) ||
  mongoose.model<IAIChatSession, AIChatSessionModel>(
    "AIChatSession",
    aiChatSessionSchema
  );

export default AIChatSession;
