import { NextResponse } from "next/server";
import AIUsage, { AIUsageCategory } from "@/lib/models/AIUsage";
import { dbConnect } from "@/lib/db";
import { env } from "@/lib/env";
import type { SubscriptionTier } from "@/lib/auth/jwt";

/**
 * Daily limits by category and subscription tier.
 * Infinity means unlimited (skip DB entirely).
 */
const DAILY_LIMITS: Record<AIUsageCategory, Record<SubscriptionTier, number>> = {
  questions: { free: 50,  plus: Infinity, admin: Infinity },
  credits:   { free: 10,  plus: 100,      admin: Infinity },
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
  cost: number;
  resetAt: string; // ISO timestamp of next UTC midnight
}

/**
 * Checks and atomically increments the AI rate limit counter.
 * Supports variable cost (e.g. 1 credit per lesson in a module).
 * For unlimited tiers, skips the DB entirely.
 */
export async function checkAIRateLimit(
  userId: string,
  tier: SubscriptionTier,
  category: AIUsageCategory,
  cost: number = 1
): Promise<RateLimitResult> {
  const limit = DAILY_LIMITS[category][tier];

  // Compute next UTC midnight for reset header
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const resetAt = tomorrow.toISOString();

  // Rate limiting disabled — everyone gets unlimited access
  if (!env.AI_RATE_LIMIT_ENABLED) {
    return { allowed: true, limit: Infinity, used: 0, remaining: Infinity, cost, resetAt };
  }

  // Unlimited tier — skip DB entirely
  if (!isFinite(limit)) {
    return { allowed: true, limit, used: 0, remaining: Infinity, cost, resetAt };
  }

  await dbConnect();

  const dateKey = getDateKey();

  // Ensure document exists
  await AIUsage.updateOne(
    { user: userId, category, dateKey },
    { $setOnInsert: { count: 0 } },
    { upsert: true }
  );

  // Conditionally increment — only if there's enough headroom for the full cost
  const result = await AIUsage.findOneAndUpdate(
    { user: userId, category, dateKey, count: { $lte: limit - cost } },
    { $inc: { count: cost } },
    { new: true }
  );

  if (!result) {
    // Limit reached — fetch current count for headers
    const doc = await AIUsage.findOne({ user: userId, category, dateKey });
    const used = doc?.count ?? limit;
    return { allowed: false, limit, used, remaining: Math.max(0, limit - used), cost, resetAt };
  }

  return {
    allowed: true,
    limit,
    used: result.count,
    remaining: limit - result.count,
    cost,
    resetAt,
  };
}

/**
 * Convenience wrapper: returns a blocked 429 response or the rate limit result.
 */
export async function enforceAIRateLimit(
  userId: string,
  tier: SubscriptionTier,
  category: AIUsageCategory,
  cost: number = 1
): Promise<
  | { blocked: true; response: NextResponse }
  | { blocked: false; result: RateLimitResult }
> {
  const result = await checkAIRateLimit(userId, tier, category, cost);

  if (!result.allowed) {
    const response = NextResponse.json(
      {
        error: "Daily AI rate limit exceeded. Please try again tomorrow.",
        limit: result.limit,
        used: result.used,
        remaining: result.remaining,
        cost: result.cost,
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
 * Read-only check of remaining AI credits without consuming any.
 */
export async function getAICreditsRemaining(
  userId: string,
  tier: SubscriptionTier,
  category: AIUsageCategory = "credits"
): Promise<{ remaining: number; limit: number; resetAt: string }> {
  const limit = DAILY_LIMITS[category][tier];

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const resetAt = tomorrow.toISOString();

  if (!env.AI_RATE_LIMIT_ENABLED || !isFinite(limit)) {
    return { remaining: Infinity, limit, resetAt };
  }

  await dbConnect();

  const doc = await AIUsage.findOne({
    user: userId,
    category,
    dateKey: getDateKey(),
  });

  const used = doc?.count ?? 0;
  return { remaining: Math.max(0, limit - used), limit, resetAt };
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
