import mongoose, { Document, Model } from "mongoose";

export type SubmissionType = "text" | "file" | "url";

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
  createdAt: Date;
  updatedAt: Date;
}

type AssignmentModel = Model<IAssignment>;

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
  },
  {
    timestamps: true,
  }
);

assignmentSchema.index({ course: 1 });
assignmentSchema.index({ module: 1 });
assignmentSchema.index({ dueDate: 1 });

const Assignment =
  (mongoose.models.Assignment as AssignmentModel) ||
  mongoose.model<IAssignment, AssignmentModel>("Assignment", assignmentSchema);

export default Assignment;
