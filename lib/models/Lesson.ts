import mongoose, { Document, Model } from "mongoose";

export type LessonContentType = "text" | "video" | "file";

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
