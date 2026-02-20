import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { AIChatSession } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

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
      .skip((page - 1) * limit)
      .limit(limit);

    return NextResponse.json({
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    captureException(error, { message: "Get chat sessions error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
