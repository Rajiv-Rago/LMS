import mongoose, { Schema, Document, Types } from "mongoose";

export type AIUsageCategory = "questions" | "credits";

export interface IAIUsage extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  category: AIUsageCategory;
  dateKey: string; // "YYYY-MM-DD" in UTC
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const AIUsageSchema = new Schema<IAIUsage>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["questions", "credits"],
      required: true,
    },
    dateKey: {
      type: String,
      required: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// One document per user per category per day
AIUsageSchema.index({ user: 1, category: 1, dateKey: 1 }, { unique: true });

// Auto-cleanup old records after 7 days
AIUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const AIUsage: mongoose.Model<IAIUsage> =
  mongoose.models.AIUsage || mongoose.model<IAIUsage>("AIUsage", AIUsageSchema);

export default AIUsage;
