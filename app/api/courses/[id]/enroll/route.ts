import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Course } from "@/lib/models";
import Enrollment from "@/lib/models/Enrollment";
import { authenticate, requireCsrf } from "@/lib/auth";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { captureException } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications";
import * as cache from "@/lib/cache";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const { id } = await params;

    const idError = validateObjectId(id, "course ID");
    if (idError) return idError;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.accessLevel === "restricted") {
      return NextResponse.json(
        { error: "Cannot enroll in restricted course" },
        { status: 400 }
      );
    }

    if (course.instructor.toString() === user.userId) {
      return NextResponse.json(
        { error: "Instructors cannot enroll in their own courses" },
        { status: 400 }
      );
    }

    try {
      await Enrollment.create({ course: id, student: user.userId });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        return NextResponse.json(
          { error: "Already enrolled in this course" },
          { status: 400 }
        );
      }
      throw err;
    }

    await Course.findByIdAndUpdate(id, { $inc: { enrolledCount: 1 } });

    cache.invalidate(`course:${id}`);

    await sendNotification({
      userId: course.instructor.toString(),
      type: "course.enrolled",
      title: "New enrollment",
      message: `A student enrolled in "${course.title}"`,
      link: `/courses/${id}`,
    });

    return NextResponse.json({ message: "Enrolled successfully" });
  } catch (error) {
    captureException(error, { operation: "Enroll error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const { id } = await params;

    const idError = validateObjectId(id, "course ID");
    if (idError) return idError;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const result = await Enrollment.deleteOne({
      course: id,
      student: user.userId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Not enrolled in this course" },
        { status: 400 }
      );
    }

    await Course.findByIdAndUpdate(id, { $inc: { enrolledCount: -1 } });

    return NextResponse.json({ message: "Unenrolled successfully" });
  } catch (error) {
    captureException(error, { operation: "Unenroll error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
