import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Submission } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { captureException } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications";

const gradeSubmissionSchema = z.object({
  grade: z.number().min(0).max(1000),
  feedback: z.string().max(5000).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string; submissionId: string }> }
) {
  try {
    const { id, assignmentId, submissionId } = await params;
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;
    const invalidAssignmentId = validateObjectId(assignmentId, "Assignment ID");
    if (invalidAssignmentId) return invalidAssignmentId;
    const invalidSubmissionId = validateObjectId(submissionId, "Submission ID");
    if (invalidSubmissionId) return invalidSubmissionId;

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

    const isSubmissionOwner = submission.student._id.toString() === user.userId;

    if (!perms.canEdit && !isSubmissionOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      submission,
      permissions: {
        canGrade: perms.canEdit,
        canEdit: isSubmissionOwner && submission.status !== "graded",
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
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const { id, assignmentId, submissionId } = await params;
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;
    const invalidAssignmentId = validateObjectId(assignmentId, "Assignment ID");
    if (invalidAssignmentId) return invalidAssignmentId;
    const invalidSubmissionId = validateObjectId(submissionId, "Submission ID");
    if (invalidSubmissionId) return invalidSubmissionId;

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

    const perms = await getCoursePermissions(course, user);

    if (!perms.canEdit) {
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

    await sendNotification({
      userId: submission.student.toString(),
      type: "assignment.graded",
      title: "Assignment graded",
      message: `Your submission received ${validation.data.grade} points`,
      link: `/courses/${id}/assignments/${assignmentId}`,
    });

    return NextResponse.json({ submission });
  } catch (error) {
    captureException(error, { operation: "Grade submission error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
