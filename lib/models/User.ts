import mongoose, { Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  password?: string;
  role: "user" | "admin";
  subscriptionTier: "free" | "plus" | "admin";
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  failedLoginAttempts: number;
  lockUntil?: Date;
  aiPreferences?: {
    defaultTier?: "concise" | "balanced" | "thorough";
    defaultProvider?: "openai" | "anthropic" | "cerebras" | "gemini";
    defaultModel?: string;
  };
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  isLocked(): boolean;
}

interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  isLocked(): boolean;
}

type UserModel = Model<IUser, object, IUserMethods>;

const userSchema = new mongoose.Schema<IUser, UserModel, IUserMethods>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ["user", "admin"],
        message: "Role must be user or admin",
      },
      default: "user",
    },
    subscriptionTier: {
      type: String,
      enum: {
        values: ["free", "plus", "admin"],
        message: "Subscription tier must be free, plus, or admin",
      },
      default: "free",
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    aiPreferences: {
      defaultTier: {
        type: String,
        enum: ["concise", "balanced", "thorough"],
      },
      defaultProvider: {
        type: String,
        enum: ["openai", "anthropic", "cerebras", "gemini"],
      },
      defaultModel: {
        type: String,
      },
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.password || !this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(this.password, salt);
  this.password = hashedPassword;
  next();
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

userSchema.pre(/^find/, function (this: mongoose.Query<unknown, IUser>, next) {
  if (!this.getOptions().includeSoftDeleted) {
    this.where({ deletedAt: null });
  }
  next();
});

userSchema.index({ deletedAt: 1 });
userSchema.index({ role: 1 });

const User =
  (mongoose.models.User as UserModel) ||
  mongoose.model<IUser, UserModel>("User", userSchema);

export default User;
