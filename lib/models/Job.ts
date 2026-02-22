import mongoose, { Document, Model } from "mongoose";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface IJob extends Document {
  _id: mongoose.Types.ObjectId;
  type: string;
  status: JobStatus;
  data: Record<string, unknown>;
  userId: mongoose.Types.ObjectId;
  attempts: number;
  maxAttempts: number;
  error?: string;
  result?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type JobModel = Model<IJob>;

const jobSchema = new mongoose.Schema<IJob, JobModel>(
  {
    type: {
      type: String,
      required: [true, "Job type is required"],
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "processing", "completed", "failed"],
        message: "Status must be pending, processing, completed, or failed",
      },
      default: "pending",
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    error: {
      type: String,
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

jobSchema.index({ status: 1, createdAt: 1 });
jobSchema.index({ userId: 1, createdAt: -1 });

const Job =
  (mongoose.models.Job as JobModel) ||
  mongoose.model<IJob, JobModel>("Job", jobSchema);

export default Job;
