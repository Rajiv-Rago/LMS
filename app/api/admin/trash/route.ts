import { NextRequest, NextResponse } from "next/server";
import { dbConnect, withTransaction } from "@/lib/db";
import { authenticate } from "@/lib/auth";
import {
  Course,
  Module,
  Lesson,
  Assignment,
  Submission,
} from "@/lib/models";
import { captureException } from "@/lib/logger";

// GET — list soft-deleted courses
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const deletedCourses = await Course.find(
      { deletedAt: { $ne: null } },
      null,
      { includeSoftDeleted: true }
    )
      .populate("instructor", "name email")
      .sort({ deletedAt: -1 });

    return NextResponse.json({ courses: deletedCourses });
  } catch (error) {
    captureException(error, { operation: "List trash error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH — restore a soft-deleted course
export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { courseId } = await request.json();
    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const course = await Course.findOne(
      { _id: courseId, deletedAt: { $ne: null } },
      null,
      { includeSoftDeleted: true }
    );

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    course.deletedAt = null;
    await course.save();

    return NextResponse.json({ course });
  } catch (error) {
    captureException(error, { operation: "Restore course error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE — permanently delete a soft-deleted course (hard purge)
export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { courseId } = await request.json();
    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const course = await Course.findOne(
      { _id: courseId, deletedAt: { $ne: null } },
      null,
      { includeSoftDeleted: true }
    );

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    await withTransaction(async (session) => {
      // Delete all assignments and their submissions
      const assignments = await Assignment.find(
        { course: courseId },
        null,
        { session, includeSoftDeleted: true }
      );
      for (const assignment of assignments) {
        await Submission.deleteMany(
          { assignment: assignment._id },
          { session }
        );
      }
      await Assignment.deleteMany({ course: courseId }, { session });

      // Delete all lessons in all modules
      const modules = await Module.find({ course: courseId }, null, { session });
      for (const mod of modules) {
        await Lesson.deleteMany({ module: mod._id }, { session });
      }
      await Module.deleteMany({ course: courseId }, { session });

      // Delete the course itself
      await course.deleteOne({ session });
    });

    return NextResponse.json({ message: "Course permanently deleted" });
  } catch (error) {
    captureException(error, { operation: "Hard delete course error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
