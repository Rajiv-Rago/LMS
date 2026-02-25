import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { AIChatSession } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import { parsePagination, paginationMeta } from "@/lib/utils/pagination";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const { page, limit, skip } = parsePagination(request);

    await dbConnect();

    const query: Record<string, unknown> = { user: user.userId };
    if (courseId) {
      query.course = courseId;
    }

    const total = await AIChatSession.countDocuments(query);
    const sessions = await AIChatSession.find(query)
      .populate("course", "title")
      .populate("lesson", "title")
      .select("title course lesson provider createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json({
      sessions,
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    captureException(error, { operation: "Get chat sessions error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
