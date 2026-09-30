import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { AIChatSession, Course } from "@/lib/models";
import { authenticate, requireCsrf, requireVerifiedEmail } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { parsePagination, paginationMeta } from "@/lib/utils/pagination";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    if (courseId) {
      const invalid = validateObjectId(courseId, "Course ID");
      if (invalid) return invalid;
    }
    const { page, limit, skip } = parsePagination(request);

    await dbConnect();

    if (courseId) {
      const course = await Course.findById(courseId);
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
      if (!(await getCoursePermissions(course, user)).canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const query: Record<string, unknown> = { user: user.userId };
    if (courseId) {
      query.course = courseId;
    }

    if (searchParams.get("active") === "true") query.isActive = true;

    const total = await AIChatSession.countDocuments(query);
    const sessions = await AIChatSession.find(query)
      .populate("course", "title")
      .populate("lesson", "title")
      .select("title course lesson provider createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json({
      userId: user.userId,
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

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const verifyError = requireVerifiedEmail(user);
    if (verifyError) return verifyError;
    const { courseId } = await request.json();
    if (typeof courseId !== "string") return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
    const invalid = validateObjectId(courseId, "Course ID");
    if (invalid) return invalid;
    await dbConnect();
    const course = await Course.findById(courseId);
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    if (!(await getCoursePermissions(course, user)).canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await AIChatSession.updateMany({ user: user.userId, course: courseId, isActive: true }, { $set: { isActive: false } });
    return NextResponse.json({ message: "New chat ready" });
  } catch (error) {
    captureException(error, { operation: "New tutor chat" });
    return NextResponse.json({ error: "Could not start a new chat" }, { status: 500 });
  }
}
