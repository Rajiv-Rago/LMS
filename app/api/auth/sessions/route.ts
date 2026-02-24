import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Session from "@/lib/models/Session";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import { parsePagination, paginationMeta } from "@/lib/utils/pagination";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, { limit: 50, maxLimit: 50 });
    const filter = { userId: user.userId, expiresAt: { $gt: new Date() } };

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .select("ip userAgent lastActiveAt createdAt")
        .sort({ lastActiveAt: -1 })
        .skip(skip)
        .limit(limit),
      Session.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: sessions.map((s) => ({
        id: s._id,
        ip: s.ip,
        userAgent: s.userAgent,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
      })),
      pagination: paginationMeta(page, limit, total),
    });
  } catch (error) {
    captureException(error, { operation: "List sessions error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
