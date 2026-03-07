import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Course, Lesson } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { captureException } from "@/lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courseId, lessonId } = await params;

    if (
      !mongoose.Types.ObjectId.isValid(courseId) ||
      !mongoose.Types.ObjectId.isValid(lessonId)
    ) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await dbConnect();

    const course = await Course.findById(courseId);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const perms = await getCoursePermissions(course, user);
    if (!perms.canEdit && !perms.isSharedWith) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (!lesson.previousContent) {
      return NextResponse.json(
        { error: "No previous version available" },
        { status: 404 }
      );
    }

    lesson.content = lesson.previousContent;
    lesson.keyTakeaways = lesson.previousKeyTakeaways || [];
    lesson.previousContent = undefined;
    lesson.previousKeyTakeaways = undefined;

    await lesson.save();

    return NextResponse.json({ lesson });
  } catch (error) {
    captureException(error, { operation: "Revert lesson content error" });
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}
