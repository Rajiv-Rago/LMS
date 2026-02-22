import mongoose, { Document, Model } from "mongoose";

export type SubmissionType = "text" | "file" | "url";
export type AssignmentType = "standard" | "quiz" | "project";

export interface IQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // index
  explanation?: string;
  points: number;
}

export interface IQuizSettings {
  timeLimit?: number; // minutes (optional)
  shuffleQuestions: boolean;
  showCorrectAnswers: boolean; // show after each attempt
}

export interface IProjectSettings {
  maxFiles: number; // default: 5
  maxFileSize: number; // bytes, default: 10MB
  allowedFileTypes: string[]; // e.g., [".pdf", ".zip"]
}

export interface IAssignment extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  course: mongoose.Types.ObjectId;
  module?: mongoose.Types.ObjectId;
  dueDate: Date;
  points: number;
  submissionType: SubmissionType;
  allowedFileTypes?: string[];
  maxFileSize?: number;
  isPublished: boolean;
  // New fields for quizzes and projects
  assignmentType: AssignmentType;
  questions?: IQuizQuestion[];
  quizSettings?: IQuizSettings;
  instructions?: string; // markdown for projects
  projectSettings?: IProjectSettings;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type AssignmentModel = Model<IAssignment>;

const quizQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true },
    explanation: { type: String },
    points: { type: Number, required: true, default: 1 },
  },
  { _id: false }
);

const quizSettingsSchema = new mongoose.Schema(
  {
    timeLimit: { type: Number }, // minutes
    shuffleQuestions: { type: Boolean, default: false },
    showCorrectAnswers: { type: Boolean, default: true },
  },
  { _id: false }
);

const projectSettingsSchema = new mongoose.Schema(
  {
    maxFiles: { type: Number, default: 5 },
    maxFileSize: { type: Number, default: 10 * 1024 * 1024 }, // 10MB
    allowedFileTypes: [{ type: String }],
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema<IAssignment, AssignmentModel>(
  {
    title: {
      type: String,
      required: [true, "Assignment title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Assignment description is required"],
      maxlength: [10000, "Description cannot exceed 10000 characters"],
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
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    points: {
      type: Number,
      required: [true, "Points value is required"],
      min: [0, "Points cannot be negative"],
      max: [1000, "Points cannot exceed 1000"],
    },
    submissionType: {
      type: String,
      enum: {
        values: ["text", "file", "url"],
        message: "Submission type must be text, file, or url",
      },
      default: "text",
    },
    allowedFileTypes: [
      {
        type: String,
      },
    ],
    maxFileSize: {
      type: Number,
      default: 10 * 1024 * 1024, // 10MB
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    // Assignment type (standard, quiz, or project)
    assignmentType: {
      type: String,
      enum: {
        values: ["standard", "quiz", "project"],
        message: "Assignment type must be standard, quiz, or project",
      },
      default: "standard",
    },
    // Quiz fields
    questions: [quizQuestionSchema],
    quizSettings: quizSettingsSchema,
    // Project fields
    instructions: {
      type: String,
      maxlength: [50000, "Instructions cannot exceed 50000 characters"],
    },
    projectSettings: projectSettingsSchema,
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
assignmentSchema.pre(/^find/, function (this: mongoose.Query<unknown, IAssignment>, next) {
  if (!this.getOptions().includeSoftDeleted) {
    this.where({ deletedAt: null });
  }
  next();
});

assignmentSchema.index({ deletedAt: 1 });
assignmentSchema.index({ course: 1 });
assignmentSchema.index({ course: 1, isPublished: 1, dueDate: 1 });
assignmentSchema.index({ module: 1 });
assignmentSchema.index({ dueDate: 1 });

const Assignment =
  (mongoose.models.Assignment as AssignmentModel) ||
  mongoose.model<IAssignment, AssignmentModel>("Assignment", assignmentSchema);

export default Assignment;
