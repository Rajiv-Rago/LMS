import mongoose, { Document, Model } from "mongoose";

export type SubmissionStatus = "draft" | "submitted" | "graded" | "returned";

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
  createdAt: Date;
  updatedAt: Date;
}

type SubmissionModel = Model<ISubmission>;

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
