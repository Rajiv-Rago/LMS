import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Course } from "@/lib/models";
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
    const { page, limit, skip } = parsePagination(searchParams, { limit: 10, maxLimit: 100 });
    const status = searchParams.get("status");

    await dbConnect();

    const query: Record<string, unknown> = {
      courseType: "ai-generated",
      owner: user.userId,
    };

    if (status) {
      query.syllabusStatus = status;
    }

    const [courses, total] = await Promise.all([
      Course.find(query)
        .populate({
          path: "modules",
          populate: {
            path: "lessons",
            model: "Lesson",
            select: "title generationStatus order",
          },
          select: "title contentStatus order",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Course.countDocuments(query),
    ]);

    return NextResponse.json({
      data: courses,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (error) {
    captureException(error, { operation: "Get my AI courses error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
