import mongoose, { Document, Model } from "mongoose";

export interface ISession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  ip: string;
  userAgent: string;
  lastActiveAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

type SessionModel = Model<ISession>;

const sessionSchema = new mongoose.Schema<ISession, SessionModel>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    ip: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      default: "unknown",
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

sessionSchema.index({ userId: 1 });
sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL: auto-delete expired

const Session =
  (mongoose.models.Session as SessionModel) ||
  mongoose.model<ISession, SessionModel>("Session", sessionSchema);

export default Session;
