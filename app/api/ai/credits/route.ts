import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAICreditsRemaining } from "@/lib/ai/rateLimit";
import { dbConnect } from "@/lib/db";
import { captureException } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const tier = user.role === "admin" ? "admin" as const : user.subscriptionTier;
    const { remaining, limit, resetAt } = await getAICreditsRemaining(
      user.userId,
      tier
    );

    return NextResponse.json({
      remaining: isFinite(remaining) ? remaining : null,
      limit: isFinite(limit) ? limit : null,
      resetAt,
    });
  } catch (error) {
    captureException(error, { operation: "Get AI credits error" });
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}
