import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Report } from "@/lib/models";
import { requireRole } from "@/lib/auth/middleware";
import { parsePagination, paginationMeta } from "@/lib/utils/pagination";
import { captureException } from "@/lib/logger";

export const GET = requireRole("admin")(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "open";
    const { page, limit, skip } = parsePagination(request);

    await dbConnect();

    const query = { status };
    const total = await Report.countDocuments(query);
    const reports = await Report.find(query)
      .populate("course", "title accessLevel moderationRemovedAt")
      .populate("reporter", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json({
      reports,
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    captureException(error, { operation: "List reports error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
