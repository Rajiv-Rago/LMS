import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Assignment, Submission } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications";
import { parsePagination, paginationMeta } from "@/lib/utils/pagination";

const createSubmissionSchema = z.object({
  content: z.string().max(50000).optional(),
  fileUrl: z.string().url().optional(),
  url: z.string().url().optional(),
  status: z.enum(["draft", "submitted"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id, assignmentId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isInstructor = user && course.instructor.toString() === user.userId;
    const isAdmin = user?.role === "admin";

    if (!isInstructor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { page, limit, skip } = parsePagination(request);

    const query = { assignment: assignmentId };
    const [submissions, total] = await Promise.all([
      Submission.find(query)
        .populate("student", "name email")
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit),
      Submission.countDocuments(query),
    ]);

    return NextResponse.json({
      submissions,
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    captureException(error, { operation: "Get submissions error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id, assignmentId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createSubmissionSchema.safeParse(body);

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

    const isEnrolled = course.enrolledStudents.some(
      (s: { toString: () => string }) => s.toString() === user.userId
    );

    if (!isEnrolled) {
      return NextResponse.json(
        { error: "You must be enrolled to submit" },
        { status: 403 }
      );
    }

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      course: id,
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    if (!assignment.isPublished) {
      return NextResponse.json(
        { error: "Assignment not available" },
        { status: 400 }
      );
    }

    let submission = await Submission.findOne({
      assignment: assignmentId,
      student: user.userId,
    });

    if (submission) {
      if (submission.status === "graded" || submission.status === "returned") {
        return NextResponse.json(
          { error: "Cannot modify graded submission" },
          { status: 400 }
        );
      }

      const { content, fileUrl, url, status } = validation.data;
      if (content !== undefined) submission.content = content;
      if (fileUrl !== undefined) submission.fileUrl = fileUrl;
      if (url !== undefined) submission.url = url;
      if (status !== undefined) submission.status = status;
      if (validation.data.status === "submitted") {
        submission.submittedAt = new Date();
      }
      await submission.save();
    } else {
      submission = await Submission.create({
        ...validation.data,
        assignment: assignmentId,
        student: user.userId,
        submittedAt:
          validation.data.status === "submitted" ? new Date() : undefined,
      });
    }

    if (submission.status === "submitted") {
      await sendNotification({
        userId: course.instructor.toString(),
        type: "assignment.submitted",
        title: "New submission",
        message: `A student submitted "${assignment.title}"`,
        link: `/courses/${id}/assignments/${assignmentId}/submissions`,
      });
    }

    return NextResponse.json({ submission }, { status: submission.isNew ? 201 : 200 });
  } catch (error) {
    captureException(error, { operation: "Create submission error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
