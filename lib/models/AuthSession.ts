import mongoose, { Document, Model } from "mongoose";

export interface IAuthSession extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  ip: string;
  userAgent: string;
  lastActiveAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

type AuthSessionModel = Model<IAuthSession>;

const authSessionSchema = new mongoose.Schema<IAuthSession, AuthSessionModel>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

authSessionSchema.index({ userId: 1, lastActiveAt: -1 });
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthSession =
  (mongoose.models.AuthSession as AuthSessionModel) ||
  mongoose.model<IAuthSession, AuthSessionModel>("AuthSession", authSessionSchema);

export default AuthSession;
