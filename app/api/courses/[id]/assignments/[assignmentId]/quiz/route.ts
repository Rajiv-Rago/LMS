import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Course, Assignment, Submission } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import {
  isAttemptValid,
} from "@/lib/utils/quizGrader";
import { captureException } from "@/lib/logger";

// POST /api/courses/[id]/assignments/[assignmentId]/quiz
// DEPRECATED: Use /quiz/start or /quiz/submit instead
export async function POST() {
  return NextResponse.json(
    {
      error: "This endpoint has been split. Use /quiz/start or /quiz/submit",
    },
    { status: 410 }
  );
}

// GET /api/courses/[id]/assignments/[assignmentId]/quiz
// Get quiz status and previous attempts for a student
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id, assignmentId } = await params;
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;
    const invalidAssignmentId = validateObjectId(assignmentId, "Assignment ID");
    if (invalidAssignmentId) return invalidAssignmentId;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      course: id,
      assignmentType: "quiz",
    });

    if (!assignment) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const perms = await getCoursePermissions(course, user);

    if (!perms.canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // For instructors/admins, return full quiz details
    if (perms.canEdit) {
      return NextResponse.json({
        assignment,
        isInstructor: true,
      });
    }

    // For students, return quiz info and their attempts
    const submission = await Submission.findOne({
      assignment: assignmentId,
      student: user.userId,
    });

    const attempts = submission?.quizAttempts?.map((attempt) => ({
      attemptNumber: attempt.attemptNumber,
      score: attempt.score,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
    })) || [];

    // Check if there's an active (incomplete) attempt
    const lastAttempt = submission?.quizAttempts?.slice(-1)[0];
    const hasActiveAttempt = !!(lastAttempt && !lastAttempt.completedAt);

    let activeAttemptExpired = false;
    if (hasActiveAttempt && assignment.quizSettings?.timeLimit) {
      activeAttemptExpired = !isAttemptValid(
        lastAttempt.startedAt,
        assignment.quizSettings.timeLimit
      );
    }

    return NextResponse.json({
      quiz: {
        title: assignment.title,
        description: assignment.description,
        points: assignment.points,
        dueDate: assignment.dueDate,
        questionCount: assignment.questions?.length || 0,
        timeLimit: assignment.quizSettings?.timeLimit,
        showCorrectAnswers: assignment.quizSettings?.showCorrectAnswers,
      },
      attempts,
      bestScore: submission?.bestScore || null,
      hasActiveAttempt: hasActiveAttempt && !activeAttemptExpired,
      activeAttemptExpired,
    });
  } catch (error) {
    captureException(error, { operation: "Get quiz error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
