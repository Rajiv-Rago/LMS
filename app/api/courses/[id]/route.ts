import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import * as cache from "@/lib/cache";
import { httpUrl } from "@/lib/validation/commonSchemas";

const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  coverImage: httpUrl.optional().nullable(),
  isPublished: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticate(request);

    await dbConnect();

    const course = await Course.findById(id)
      .populate("instructor", "name email")
      .populate("modules", "title description order isPublished lessons")
      .populate("enrolledStudents", "name email");

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isInstructor = user && course.instructor._id.toString() === user.userId;
    const isEnrolled =
      user &&
      course.enrolledStudents.some(
        (s: { _id: { toString: () => string } }) => s._id.toString() === user.userId
      );
    const isAdmin = user?.role === "admin";

    if (!course.isPublished && !isInstructor && !isEnrolled && !isAdmin) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courseObj: any = course.toObject();

    // Strip enrolled student details for non-privileged users
    if (!isInstructor && !isAdmin) {
      courseObj.enrolledCount = course.enrolledStudents.length;
      delete courseObj.enrolledStudents;
    }

    return NextResponse.json({
      course: courseObj,
      permissions: {
        canEdit: isInstructor || isAdmin,
        canEnroll: !isInstructor && !isEnrolled && course.isPublished,
        isEnrolled,
        isInstructor,
      },
    });
  } catch (error) {
    captureException(error, { operation: "Get course error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const { id } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateCourseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.instructor.toString() !== user.userId && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, description, coverImage, isPublished } = validation.data;
    if (title !== undefined) course.title = title;
    if (description !== undefined) course.description = description;
    if (coverImage !== undefined) course.coverImage = coverImage ?? undefined;
    if (isPublished !== undefined) course.isPublished = isPublished;
    await course.save();

    await course.populate("instructor", "name email");

    cache.invalidate(`course:${id}`);
    cache.invalidatePrefix("courses:published");

    return NextResponse.json({ course });
  } catch (error) {
    captureException(error, { operation: "Update course error" });
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
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.instructor.toString() !== user.userId && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft-delete: mark as deleted instead of removing
    course.deletedAt = new Date();
    await course.save();

    cache.invalidate(`course:${id}`);
    cache.invalidatePrefix("courses:published");

    return NextResponse.json({ message: "Course deleted successfully" });
  } catch (error) {
    captureException(error, { operation: "Delete course error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
