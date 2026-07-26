import { NextResponse } from "next/server";
import RateLimit from "@/lib/models/RateLimit";
import { dbConnect } from "@/lib/db";

/**
 * Generic fixed-window rate limiter backed by MongoDB.
 * Returns a 429 response when the limit is exceeded, null otherwise.
 * `id` is the caller identity (IP for anonymous routes, userId for authed ones).
 */
export async function enforceRateLimit(
  action: string,
  id: string,
  limit: number,
  window: "hour" | "day"
): Promise<NextResponse | null> {
  await dbConnect();

  const windowKey = new Date().toISOString().slice(0, window === "hour" ? 13 : 10);
  const key = `${action}:${id}:${windowKey}`;

  // Ensure document exists, then conditionally increment — atomic, no races
  await RateLimit.updateOne(
    { key },
    { $setOnInsert: { count: 0 } },
    { upsert: true }
  );

  const result = await RateLimit.findOneAndUpdate(
    { key, count: { $lt: limit } },
    { $inc: { count: 1 } },
    { new: true }
  );

  if (!result) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  return null;
}
