import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Course, Assignment, Submission } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { captureException } from "@/lib/logger";

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

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const perms = await getCoursePermissions(course, user);

    if (!perms.canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const assignments = await Assignment.find({
      course: id,
      isPublished: true,
    }).sort({ dueDate: 1 });

    const submissions = await Submission.find({
      assignment: { $in: assignments.map((a) => a._id) },
      student: user.userId,
    });

    const submissionMap = new Map<string, typeof submissions[0]>();
    submissions.forEach((sub) => {
      submissionMap.set(sub.assignment.toString(), sub);
    });

    const grades = assignments.map((assignment) => {
      const submission = submissionMap.get(assignment._id.toString());

      return {
        assignment: {
          _id: assignment._id,
          title: assignment.title,
          points: assignment.points,
          dueDate: assignment.dueDate,
        },
        submission: submission
          ? {
              _id: submission._id,
              status: submission.status,
              grade: submission.grade,
              feedback: submission.feedback,
              submittedAt: submission.submittedAt,
              gradedAt: submission.gradedAt,
            }
          : null,
      };
    });

    const totalPoints = assignments.reduce((sum, a) => sum + a.points, 0);
    const earnedPoints = submissions.reduce((sum, s) => sum + (s.grade || 0), 0);
    const gradedCount = submissions.filter((s) => s.grade !== undefined).length;

    return NextResponse.json({
      grades,
      summary: {
        totalAssignments: assignments.length,
        submittedCount: submissions.length,
        gradedCount,
        totalPoints,
        earnedPoints,
        percentage:
          totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
      },
    });
  } catch (error) {
    captureException(error, { operation: "Get grades error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
