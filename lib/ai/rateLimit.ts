import { NextResponse } from "next/server";
import AIUsage, { AIUsageCategory } from "@/lib/models/AIUsage";
import { dbConnect } from "@/lib/db";

type UserRole = "student" | "teacher" | "admin";

/**
 * Daily request limits by role and category.
 */
const DAILY_LIMITS: Record<AIUsageCategory, Record<UserRole, number>> = {
  chat: { student: 50, teacher: 200, admin: 10_000 },
  generate: { student: 10, teacher: 50, admin: 10_000 },
  course_generation: { student: 5, teacher: 20, admin: 10_000 },
};

/**
 * Returns today's UTC date key in "YYYY-MM-DD" format.
 */
function getDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  resetAt: string; // ISO timestamp of next UTC midnight
}

/**
 * Checks and atomically increments the AI rate limit counter.
 * Race-condition-free: uses conditional $inc so two concurrent requests
 * cannot both sneak past the limit.
 */
export async function checkAIRateLimit(
  userId: string,
  role: UserRole,
  category: AIUsageCategory
): Promise<RateLimitResult> {
  await dbConnect();

  const limit = DAILY_LIMITS[category][role];
  const dateKey = getDateKey();

  // Ensure document exists
  await AIUsage.updateOne(
    { user: userId, category, dateKey },
    { $setOnInsert: { count: 0 } },
    { upsert: true }
  );

  // Conditionally increment — only if under the limit
  const result = await AIUsage.findOneAndUpdate(
    { user: userId, category, dateKey, count: { $lt: limit } },
    { $inc: { count: 1 } },
    { new: true }
  );

  // Compute next UTC midnight for reset header
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const resetAt = tomorrow.toISOString();

  if (!result) {
    // Limit reached — fetch current count for headers
    const doc = await AIUsage.findOne({ user: userId, category, dateKey });
    const used = doc?.count ?? limit;
    return { allowed: false, limit, used, remaining: 0, resetAt };
  }

  return {
    allowed: true,
    limit,
    used: result.count,
    remaining: limit - result.count,
    resetAt,
  };
}

/**
 * Convenience wrapper: returns a blocked 429 response or the rate limit result.
 */
export async function enforceAIRateLimit(
  userId: string,
  role: UserRole,
  category: AIUsageCategory
): Promise<
  | { blocked: true; response: NextResponse }
  | { blocked: false; result: RateLimitResult }
> {
  const result = await checkAIRateLimit(userId, role, category);

  if (!result.allowed) {
    const response = NextResponse.json(
      {
        error: "Daily AI rate limit exceeded. Please try again tomorrow.",
        limit: result.limit,
        used: result.used,
        resetAt: result.resetAt,
      },
      { status: 429 }
    );
    addRateLimitHeaders(response, result);
    return { blocked: true, response };
  }

  return { blocked: false, result };
}

/**
 * Sets standard rate limit headers on a response.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): void {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", result.resetAt);
}
