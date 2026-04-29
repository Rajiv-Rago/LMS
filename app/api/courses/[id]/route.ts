import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course } from "@/lib/models";
import Enrollment from "@/lib/models/Enrollment";
import { authenticate, requireCsrf } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { captureException } from "@/lib/logger";
import * as cache from "@/lib/cache";
import { httpUrl } from "@/lib/validation/commonSchemas";

const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  coverImage: httpUrl.optional().nullable(),
  isPublished: z.boolean().optional(),
  accessLevel: z.enum(["restricted", "unlisted", "published"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;

    const user = await authenticate(request);

    await dbConnect();

    const course = await Course.findById(id)
      .populate("instructor", "name email")
      .populate("modules", "title description order isPublished lessons");

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const perms = await getCoursePermissions(course, user);

    if (!perms.canView) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courseObj: any = course.toObject();
    delete courseObj.enrolledStudents;

    const enrolledCount = await Enrollment.getEnrollmentCount(course._id);
    courseObj.enrolledCount = enrolledCount;

    return NextResponse.json({
      course: courseObj,
      permissions: {
        canEdit: perms.canEdit,
        canEnroll: !perms.isInstructor && !perms.isEnrolled && course.accessLevel !== "restricted",
        isEnrolled: perms.isEnrolled,
        isInstructor: perms.isInstructor,
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
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;

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

    const perms = await getCoursePermissions(course, user);

    if (!perms.canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, description, coverImage, isPublished, accessLevel } = validation.data;
    if (title !== undefined) course.title = title;
    if (description !== undefined) course.description = description;
    if (coverImage !== undefined) course.coverImage = coverImage ?? undefined;
    if (accessLevel !== undefined) {
      course.accessLevel = accessLevel;
    } else if (isPublished !== undefined) {
      course.accessLevel = isPublished ? "published" : "restricted";
    }
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
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const perms = await getCoursePermissions(course, user);

    if (!perms.canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await Course.findByIdAndUpdate(id, { deletedAt: new Date() });

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
