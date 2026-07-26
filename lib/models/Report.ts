import mongoose, { Document, Model } from "mongoose";

export type ReportReason = "spam" | "copyright" | "inappropriate" | "other";
export type ReportStatus = "open" | "resolved" | "dismissed";

export interface IReport extends Document {
  _id: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  reporter: mongoose.Types.ObjectId;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

type ReportModel = Model<IReport>;

const reportSchema = new mongoose.Schema<IReport, ReportModel>(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      enum: ["spam", "copyright", "inappropriate", "other"],
      required: true,
    },
    details: {
      type: String,
      maxlength: [2000, "Details cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: ["open", "resolved", "dismissed"],
      default: "open",
    },
  },
  {
    timestamps: true,
  }
);

reportSchema.index({ status: 1, createdAt: -1 });

const Report =
  (mongoose.models.Report as ReportModel) ||
  mongoose.model<IReport, ReportModel>("Report", reportSchema);

export default Report;
