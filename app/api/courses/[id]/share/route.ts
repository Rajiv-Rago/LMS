import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course } from "@/lib/models";
import User from "@/lib/models/User";
import { authenticate, requireCsrf } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { captureException } from "@/lib/logger";

const shareSchema = z.object({
  email: z.string().email(),
});

const MAX_SHARES_STUDENT = 5;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id).populate(
      "sharedWith",
      "name email"
    );

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const perms = await getCoursePermissions(course, user);

    if (!perms.canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      sharedWith: course.sharedWith || [],
      maxShares: user.role !== "admin" ? MAX_SHARES_STUDENT : null,
    });
  } catch (error) {
    captureException(error, { operation: "Get course shares error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const validation = shareSchema.safeParse(body);

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

    if (
      user.role !== "admin" &&
      (course.sharedWith?.length || 0) >= MAX_SHARES_STUDENT
    ) {
      return NextResponse.json(
        { error: `You can share with up to ${MAX_SHARES_STUDENT} people` },
        { status: 400 }
      );
    }

    const targetUser = await User.findOne({
      email: validation.data.email.toLowerCase(),
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found with that email" },
        { status: 404 }
      );
    }

    if (targetUser._id.toString() === user.userId) {
      return NextResponse.json(
        { error: "You cannot share a course with yourself" },
        { status: 400 }
      );
    }

    if (course.sharedWith?.some((s) => s.toString() === targetUser._id.toString())) {
      return NextResponse.json(
        { error: "Course is already shared with this user" },
        { status: 400 }
      );
    }

    await Course.findByIdAndUpdate(id, {
      $addToSet: { sharedWith: targetUser._id },
    });

    return NextResponse.json({
      message: "Course shared successfully",
      sharedUser: { _id: targetUser._id, name: targetUser.name, email: targetUser.email },
    });
  } catch (error) {
    captureException(error, { operation: "Share course error" });
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

    const { searchParams } = new URL(request.url);
    const removeUserId = searchParams.get("userId");

    if (!removeUserId) {
      return NextResponse.json(
        { error: "userId query parameter is required" },
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

    await Course.findByIdAndUpdate(id, {
      $pull: { sharedWith: removeUserId },
    });

    return NextResponse.json({ message: "User removed from shared list" });
  } catch (error) {
    captureException(error, { operation: "Remove course share error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
