# 01 - Database Schema (MongoDB Atlas)

## Status: DRAFT
## Last Updated: 2026-02-21

---

## Connection Setup

### File: `src/lib/db.ts`

Use a singleton pattern to avoid multiple connections in serverless:

```typescript
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not set");
}

let cached = (global as any).mongoose;
if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
```

---

## Collections & Schemas

### 1. `users`

Stores user accounts. Managed jointly by NextAuth and custom fields.

```typescript
// src/models/User.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  emailVerified: Date | null;
  name: string;
  image: string | null;                  // Google profile picture URL
  hashedPassword: string | null;         // null for OAuth-only users
  provider: "google" | "credentials";    // Primary auth method

  // Subscription
  tier: "free" | "pro" | "team";
  stripeCustomerId: string | null;       // Stripe customer ID (cus_xxx)
  stripeSubscriptionId: string | null;   // Active subscription (sub_xxx)

  // Usage tracking
  pathsGeneratedThisMonth: number;       // Resets on billing cycle
  usagePeriodStart: Date;                // Start of current billing period

  // Password reset (credentials users only)
  resetToken: string | null;             // SHA-256 hashed token
  resetTokenExpiry: Date | null;         // 1-hour expiry

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    emailVerified: { type: Date, default: null },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    image: { type: String, default: null },
    hashedPassword: { type: String, default: null },
    provider: {
      type: String,
      enum: ["google", "credentials"],
      required: true,
    },
    tier: {
      type: String,
      enum: ["free", "pro", "team"],
      default: "free",
    },
    stripeCustomerId: { type: String, default: null, sparse: true },
    stripeSubscriptionId: { type: String, default: null, sparse: true },
    pathsGeneratedThisMonth: { type: Number, default: 0 },
    usagePeriodStart: { type: Date, default: Date.now },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    lastLoginAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
UserSchema.index({ stripeCustomerId: 1 }, { sparse: true });
UserSchema.index({ email: 1 }, { unique: true });
```

---

### 2. `learning_paths`

Stores the AI-generated learning path data. One document per path.

```typescript
// src/models/LearningPath.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ILearningPath extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;       // Owner (ref: users)

  // Form inputs that generated this path
  formData: {
    topic: string;
    skillLevel: string;
    learningGoal: string;
    videoLengths: string[];
    teachingStyles: string[];
    creatorTypes: string[];
    hoursPerWeek: string;
    timeline: string;
    excludeFilters: string[];
    includeFilters: string[];
  };

  // Path summary (computed on creation)
  summary: {
    topic: string;
    totalVideos: number;
    totalVideoHours: number;
    totalPracticeHours: number;
    totalHours: number;
    completionWeeks: number;
    startDate: string;                   // ISO date string
    finishDate: string;                  // ISO date string
  };

  // Modules (embedded array)
  modules: Array<{
    id: string;                          // "mod_1", "mod_2", etc.
    number: number;
    name: string;
    description: string;
    estimatedHours: number;
    estimatedWeeks: number;
    videos: Array<{
      videoId: string;                   // YouTube video ID
      title: string;
      channelName: string;
      duration: string;                  // "45:00" format
      durationSeconds: number;
      thumbnailUrl: string;
      viewCount: number;
      whyIncluded: string;
      keyTakeaways: string[];
      prerequisites: string[];
      practiceSuggestion: string;
    }>;
    moduleCheck: {
      description: string;
      items: string[];
    };
    practiceProject?: {
      title: string;
      description: string;
      whyThisProject: string;
      difficulty: "beginner" | "intermediate" | "advanced";
      estimatedHours: number;
    };
  }>;

  // Path variants
  variants: Array<{
    name: "fast_track" | "standard" | "deep_dive";
    label: string;
    description: string;
    totalVideos: number;
    totalHours: number;
    moduleIds: string[];
  }>;

  // Weekly schedule
  schedule: Array<{
    week: number;
    videoIds: string[];
    totalHours: number;
  }>;

  // External resources
  supplementaryResources: Array<{
    title: string;
    url: string;
    type: "documentation" | "platform" | "community" | "cheatsheet" | "reading";
    description: string;
  }>;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const LearningPathSchema = new Schema<ILearningPath>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    formData: { type: Schema.Types.Mixed, required: true },
    summary: { type: Schema.Types.Mixed, required: true },
    modules: { type: [Schema.Types.Mixed], required: true },
    variants: { type: [Schema.Types.Mixed], required: true },
    schedule: { type: [Schema.Types.Mixed], required: true },
    supplementaryResources: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

// Indexes
LearningPathSchema.index({ userId: 1, createdAt: -1 });
LearningPathSchema.index({ "summary.topic": "text" });
```

---

### 3. `path_progress`

Tracks user progress on each learning path. One document per user-path pair.

```typescript
// src/models/PathProgress.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IPathProgress extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;       // Owner (ref: users)
  pathId: mongoose.Types.ObjectId;       // Ref: learning_paths

  activeVariant: "fast_track" | "standard" | "deep_dive";

  // Per-video progress (keyed by YouTube videoId)
  videoProgress: Map<string, {
    status: "unwatched" | "watching" | "watched" | "skipped";
    watchedAt: Date | null;
    notes: string;
    timestamps: Array<{ time: string; note: string }>;
  }>;

  // Module checklist completion (keyed by module ID like "mod_1")
  moduleChecks: Map<string, boolean[]>;

  // Completed project titles
  projectsCompleted: string[];

  // Streak tracking
  streakDays: number;
  lastStreakDate: string;                // "YYYY-MM-DD"

  // Metadata
  startedAt: Date;
  lastActivityAt: Date;
}

const PathProgressSchema = new Schema<IPathProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pathId: {
      type: Schema.Types.ObjectId,
      ref: "LearningPath",
      required: true,
    },
    activeVariant: {
      type: String,
      enum: ["fast_track", "standard", "deep_dive"],
      default: "standard",
    },
    videoProgress: {
      type: Map,
      of: {
        status: {
          type: String,
          enum: ["unwatched", "watching", "watched", "skipped"],
          default: "unwatched",
        },
        watchedAt: { type: Date, default: null },
        notes: { type: String, default: "" },
        timestamps: { type: [{ time: String, note: String }], default: [] },
      },
      default: new Map(),
    },
    moduleChecks: {
      type: Map,
      of: [Boolean],
      default: new Map(),
    },
    projectsCompleted: { type: [String], default: [] },
    streakDays: { type: Number, default: 0 },
    lastStreakDate: { type: String, default: "" },
    startedAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Indexes
PathProgressSchema.index({ userId: 1, pathId: 1 }, { unique: true });
PathProgressSchema.index({ pathId: 1 });
```

---

### 4. `accounts` (NextAuth managed)

NextAuth auto-creates this for OAuth providers. Do NOT manually modify.

```
{
  userId: ObjectId,          // Ref: users
  type: "oauth",
  provider: "google",
  providerAccountId: string, // Google user ID
  access_token: string,
  refresh_token: string,
  expires_at: number,
  token_type: "Bearer",
  scope: string,
  id_token: string,
}
```

Index: `{ provider: 1, providerAccountId: 1 }` (unique, created by NextAuth)

---

### 5. `sessions` (NextAuth managed)

NextAuth session storage. Do NOT manually modify.

```
{
  sessionToken: string,      // Unique session ID
  userId: ObjectId,          // Ref: users
  expires: Date,
}
```

Index: `{ sessionToken: 1 }` (unique, created by NextAuth)

---

## Index Summary

| Collection | Index | Type | Purpose |
|------------|-------|------|---------|
| `users` | `{ email: 1 }` | Unique | Login lookup |
| `users` | `{ stripeCustomerId: 1 }` | Sparse | Stripe webhook lookup |
| `learning_paths` | `{ userId: 1, createdAt: -1 }` | Compound | List user's paths (newest first) |
| `learning_paths` | `{ "summary.topic": "text" }` | Text | Future: search paths by topic |
| `path_progress` | `{ userId: 1, pathId: 1 }` | Unique compound | One progress doc per user-path |
| `path_progress` | `{ pathId: 1 }` | Single | Lookup progress by path |

---

## MongoDB Atlas Configuration

### Cluster Settings
- **Tier**: M0 (free) for dev, M10+ for production
- **Region**: Same as Vercel deployment (e.g., `us-east-1`)
- **Version**: MongoDB 7.0+

### Network Access
- Add Vercel's IP ranges (or `0.0.0.0/0` with strong auth)
- Add developer IPs for local development

### Database Users
- Create a dedicated user with `readWrite` role on the `ytlearning` database
- Never use the admin user for the application

---

## Data Size Estimates

| Collection | Avg Doc Size | Docs/User | Notes |
|------------|-------------|-----------|-------|
| `users` | ~0.5 KB | 1 | Small, grows slowly |
| `learning_paths` | ~15-30 KB | 2-5 typical | Embedded modules/videos make docs larger |
| `path_progress` | ~5-10 KB | 1 per path | Grows as user adds notes/timestamps |
| `accounts` | ~1 KB | 1 per provider | NextAuth managed |
| `sessions` | ~0.3 KB | 1 active | NextAuth managed, expires |

At 10,000 users: ~500 MB total estimated. Well within M10 tier limits.
