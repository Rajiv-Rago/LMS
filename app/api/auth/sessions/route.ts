import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Session from "@/lib/models/Session";
import { authenticate } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const sessions = await Session.find({
      userId: user.userId,
      expiresAt: { $gt: new Date() },
    })
      .select("ip userAgent lastActiveAt createdAt")
      .sort({ lastActiveAt: -1 });

    return NextResponse.json({
      data: sessions.map((s) => ({
        id: s._id,
        ip: s.ip,
        userAgent: s.userAgent,
        lastActiveAt: s.lastActiveAt,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error("List sessions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
