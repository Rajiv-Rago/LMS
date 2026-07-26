import mongoose, { Document, Model } from "mongoose";

export interface IRateLimit extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

type RateLimitModel = Model<IRateLimit>;

const rateLimitSchema = new mongoose.Schema<IRateLimit, RateLimitModel>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// TTL: expired window docs cleaned up after 2 days
rateLimitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 24 * 3600 });

const RateLimit =
  (mongoose.models.RateLimit as RateLimitModel) ||
  mongoose.model<IRateLimit, RateLimitModel>("RateLimit", rateLimitSchema);

export default RateLimit;
