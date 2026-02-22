import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Course } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications";
import * as cache from "@/lib/cache";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (!course.isPublished) {
      return NextResponse.json(
        { error: "Cannot enroll in unpublished course" },
        { status: 400 }
      );
    }

    if (course.instructor.toString() === user.userId) {
      return NextResponse.json(
        { error: "Instructors cannot enroll in their own courses" },
        { status: 400 }
      );
    }

    const alreadyEnrolled = course.enrolledStudents.some(
      (s: { toString: () => string }) => s.toString() === user.userId
    );

    if (alreadyEnrolled) {
      return NextResponse.json(
        { error: "Already enrolled in this course" },
        { status: 400 }
      );
    }

    course.enrolledStudents.push(user.userId as unknown as typeof course.enrolledStudents[0]);
    await course.save();

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
    const { id } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isEnrolled = course.enrolledStudents.some(
      (s: { toString: () => string }) => s.toString() === user.userId
    );

    if (!isEnrolled) {
      return NextResponse.json(
        { error: "Not enrolled in this course" },
        { status: 400 }
      );
    }

    course.enrolledStudents = course.enrolledStudents.filter(
      (s: { toString: () => string }) => s.toString() !== user.userId
    );
    await course.save();

    return NextResponse.json({ message: "Unenrolled successfully" });
  } catch (error) {
    captureException(error, { operation: "Unenroll error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
