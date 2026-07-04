import mongoose, { Document, Model } from "mongoose";

export type OAuthProvider = "google" | "github";

export interface IOAuthAccount extends Document {
  _id: mongoose.Types.ObjectId;
  provider: OAuthProvider;
  providerAccountId: string;
  userId: mongoose.Types.ObjectId;
  email: string;
  emailVerified: boolean;
  name?: string;
  image?: string;
  linkedAt: Date;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

type OAuthAccountModel = Model<IOAuthAccount>;

const oauthAccountSchema = new mongoose.Schema<IOAuthAccount, OAuthAccountModel>(
  {
    provider: {
      type: String,
      enum: ["google", "github"],
      required: true,
    },
    providerAccountId: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    name: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
    },
    linkedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastLoginAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

oauthAccountSchema.index(
  { provider: 1, providerAccountId: 1 },
  { unique: true }
);
oauthAccountSchema.index({ userId: 1, provider: 1 }, { unique: true });
oauthAccountSchema.index({ email: 1 });

const OAuthAccount =
  (mongoose.models.OAuthAccount as OAuthAccountModel) ||
  mongoose.model<IOAuthAccount, OAuthAccountModel>(
    "OAuthAccount",
    oauthAccountSchema
  );

export default OAuthAccount;
