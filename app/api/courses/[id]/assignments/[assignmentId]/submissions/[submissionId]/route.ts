import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Submission } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";

const gradeSubmissionSchema = z.object({
  grade: z.number().min(0),
  feedback: z.string().max(5000).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string; submissionId: string }> }
) {
  try {
    const { id, assignmentId, submissionId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const submission = await Submission.findOne({
      _id: submissionId,
      assignment: assignmentId,
    })
      .populate("student", "name email")
      .populate("assignment", "title points dueDate")
      .populate("gradedBy", "name");

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    const isInstructor = course.instructor.toString() === user.userId;
    const isOwner = submission.student._id.toString() === user.userId;
    const isAdmin = user.role === "admin";

    if (!isInstructor && !isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      submission,
      permissions: {
        canGrade: isInstructor || isAdmin,
        canEdit: isOwner && submission.status !== "graded",
      },
    });
  } catch (error) {
    captureException(error, { operation: "Get submission error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string; submissionId: string }> }
) {
  try {
    const { id, assignmentId, submissionId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = gradeSubmissionSchema.safeParse(body);

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

    const isInstructor = course.instructor.toString() === user.userId;
    const isAdmin = user.role === "admin";

    if (!isInstructor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const submission = await Submission.findOne({
      _id: submissionId,
      assignment: assignmentId,
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    if (submission.status !== "submitted") {
      return NextResponse.json(
        { error: "Can only grade submitted assignments" },
        { status: 400 }
      );
    }

    submission.grade = validation.data.grade;
    submission.feedback = validation.data.feedback;
    submission.status = "graded";
    submission.gradedAt = new Date();
    submission.gradedBy = user.userId as unknown as typeof submission.gradedBy;

    await submission.save();

    return NextResponse.json({ submission });
  } catch (error) {
    captureException(error, { operation: "Grade submission error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
