import mongoose, { Document, Model } from "mongoose";
import { AIProviderName } from "@/lib/ai/types";

export type SyllabusStatus = "draft" | "generating" | "completed" | "failed";

export interface AIPreferences {
  defaultProvider: AIProviderName;
  defaultModel?: string;
}

export interface ICourse extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  instructor: mongoose.Types.ObjectId;
  enrolledStudents: mongoose.Types.ObjectId[];
  modules: mongoose.Types.ObjectId[];
  coverImage?: string;
  isPublished: boolean;
  owner?: mongoose.Types.ObjectId;
  sharedWith: mongoose.Types.ObjectId[];
  syllabusStatus?: SyllabusStatus;
  syllabusPrompt?: string;
  aiPreferences?: AIPreferences;
  youtubeMetadata?: {
    skillLevel: string;
    teachingStyle?: string;
    pathVariant?: string;
    generatedAt: Date;
  };
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type CourseModel = Model<ICourse>;

const courseSchema = new mongoose.Schema<ICourse, CourseModel>(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Course description is required"],
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Instructor is required"],
    },
    enrolledStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    modules: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Module",
      },
    ],
    coverImage: {
      type: String,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    syllabusStatus: {
      type: String,
      enum: {
        values: ["draft", "generating", "completed", "failed"],
        message: "Syllabus status must be draft, generating, completed, or failed",
      },
    },
    syllabusPrompt: {
      type: String,
      maxlength: [5000, "Syllabus prompt cannot exceed 5000 characters"],
    },
    aiPreferences: {
      defaultProvider: {
        type: String,
        enum: ["openai", "anthropic", "groq", "cerebras", "gemini"],
      },
      defaultModel: {
        type: String,
      },
    },
    youtubeMetadata: {
      skillLevel: { type: String },
      teachingStyle: { type: String },
      pathVariant: { type: String },
      generatedAt: { type: Date },
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Soft-delete: exclude deleted documents from all find queries by default
courseSchema.pre(/^find/, function (this: mongoose.Query<unknown, ICourse>, next) {
  if (!this.getOptions().includeSoftDeleted) {
    this.where({ deletedAt: null });
  }
  next();
});

courseSchema.index({ deletedAt: 1 });
courseSchema.index({ instructor: 1 });
courseSchema.index({ enrolledStudents: 1 });
courseSchema.index({ isPublished: 1 });
courseSchema.index({ title: "text", description: "text" });
courseSchema.index({ owner: 1 });
courseSchema.index({ sharedWith: 1 });

const Course =
  (mongoose.models.Course as CourseModel) ||
  mongoose.model<ICourse, CourseModel>("Course", courseSchema);

export default Course;
