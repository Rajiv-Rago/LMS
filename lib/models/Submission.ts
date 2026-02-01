import mongoose, { Document, Model } from "mongoose";

export type SubmissionStatus = "draft" | "submitted" | "graded" | "returned";

export interface IQuizAnswer {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
  pointsEarned: number;
}

export interface IQuizAttempt {
  attemptNumber: number;
  answers: IQuizAnswer[];
  score: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface IUploadedFile {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export interface ISubmission extends Document {
  _id: mongoose.Types.ObjectId;
  assignment: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  content?: string;
  fileUrl?: string;
  url?: string;
  status: SubmissionStatus;
  submittedAt?: Date;
  grade?: number;
  feedback?: string;
  gradedAt?: Date;
  gradedBy?: mongoose.Types.ObjectId;
  // Quiz submission fields
  quizAttempts?: IQuizAttempt[];
  bestScore?: number; // Highest score across all attempts (used for grade)
  // Project submission fields
  files?: IUploadedFile[];
  createdAt: Date;
  updatedAt: Date;
}

type SubmissionModel = Model<ISubmission>;

const quizAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    selectedAnswer: { type: Number, required: true },
    isCorrect: { type: Boolean, required: true },
    pointsEarned: { type: Number, required: true },
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    attemptNumber: { type: Number, required: true },
    answers: [quizAnswerSchema],
    score: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
  },
  { _id: false }
);

const uploadedFileSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema<ISubmission, SubmissionModel>(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: [true, "Assignment is required"],
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student is required"],
    },
    content: {
      type: String,
      maxlength: [50000, "Content cannot exceed 50000 characters"],
    },
    fileUrl: {
      type: String,
    },
    url: {
      type: String,
    },
    status: {
      type: String,
      enum: {
        values: ["draft", "submitted", "graded", "returned"],
        message: "Status must be draft, submitted, graded, or returned",
      },
      default: "draft",
    },
    submittedAt: {
      type: Date,
    },
    grade: {
      type: Number,
      min: [0, "Grade cannot be negative"],
    },
    feedback: {
      type: String,
      maxlength: [5000, "Feedback cannot exceed 5000 characters"],
    },
    gradedAt: {
      type: Date,
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Quiz submission fields
    quizAttempts: [quizAttemptSchema],
    bestScore: {
      type: Number,
      min: [0, "Best score cannot be negative"],
    },
    // Project submission fields
    files: [uploadedFileSchema],
  },
  {
    timestamps: true,
  }
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ student: 1 });
submissionSchema.index({ status: 1 });

const Submission =
  (mongoose.models.Submission as SubmissionModel) ||
  mongoose.model<ISubmission, SubmissionModel>("Submission", submissionSchema);

export default Submission;
