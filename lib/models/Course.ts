import mongoose, { Document, Model } from "mongoose";
import { AIProviderName } from "@/lib/ai/types";

export type SyllabusStatus = "draft" | "generating" | "completed" | "failed";

export interface AIPreferences {
  defaultProvider: AIProviderName;
  defaultModel?: string;
}

export type AccessLevel = "restricted" | "unlisted" | "published";

export interface ICourse extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  instructor: mongoose.Types.ObjectId;
  enrolledStudents: mongoose.Types.ObjectId[];
  modules: mongoose.Types.ObjectId[];
  coverImage?: string;
  accessLevel: AccessLevel;
  enrolledCount: number;
  isPublished: boolean;
  owner?: mongoose.Types.ObjectId;
  sharedWith: mongoose.Types.ObjectId[];
  syllabusStatus?: SyllabusStatus;
  syllabusPrompt?: string;
  passingScore: number;
  aiPreferences?: AIPreferences;
  youtubeMetadata?: {
    skillLevel: string;
    teachingStyle?: string;
    pathVariant?: string;
    generatedAt: Date;
  };
  references?: {
    url: string;
    title: string;
    description: string;
    sourceVerified: boolean;
  }[];
  moderationRemovedAt: Date | null;
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
    // DEPRECATED: Use Enrollment collection. This field retained for data migration only.
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
    accessLevel: {
      type: String,
      enum: ["restricted", "unlisted", "published"],
      default: "restricted",
    },
    enrolledCount: {
      type: Number,
      default: 0,
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
    // Minimum score (0-100) required on module-end tests for a module to count as completed
    passingScore: {
      type: Number,
      min: [0, "Passing score cannot be negative"],
      max: [100, "Passing score cannot exceed 100"],
      default: 70,
    },
    aiPreferences: {
      defaultProvider: {
        type: String,
        enum: ["openai", "anthropic", "cerebras", "gemini", "groq"],
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
    references: [
      {
        url: { type: String },
        title: { type: String },
        description: { type: String },
        sourceVerified: { type: Boolean, default: false },
      },
    ],
    // Set by admin moderation; hides the course from public view without
    moderationRemovedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

courseSchema.virtual("isPublished").get(function () {
  return this.accessLevel !== "restricted";
});

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
courseSchema.index({ accessLevel: 1 });
courseSchema.index({ enrolledCount: -1 });
courseSchema.index({ title: "text", description: "text" });
courseSchema.index({ owner: 1 });
courseSchema.index({ sharedWith: 1 });

const Course =
  (mongoose.models.Course as CourseModel) ||
  mongoose.model<ICourse, CourseModel>("Course", courseSchema);

export default Course;
