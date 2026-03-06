import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Assignment, Submission, Enrollment } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import {
  gradeQuiz,
  getBestScore,
  isAttemptValid,
} from "@/lib/utils/quizGrader";
import { captureException } from "@/lib/logger";

const submitQuizSchema = z.object({
  answers: z.record(z.string(), z.number()),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const { id, assignmentId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idError = validateObjectId(id, "course ID");
    if (idError) return idError;

    const assignmentIdError = validateObjectId(assignmentId, "assignment ID");
    if (assignmentIdError) return assignmentIdError;

    await dbConnect();

    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isEnrolled = await Enrollment.isEnrolled(course._id, user.userId);
    if (!isEnrolled) {
      return NextResponse.json(
        { error: "You must be enrolled to submit quizzes" },
        { status: 403 }
      );
    }

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      course: id,
      assignmentType: "quiz",
    });

    if (!assignment) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const submission = await Submission.findOne({
      assignment: assignmentId,
      student: user.userId,
    });

    if (!submission || !submission.quizAttempts?.length) {
      return NextResponse.json(
        { error: "No active quiz attempt" },
        { status: 400 }
      );
    }

    const currentAttempt = submission.quizAttempts.slice(-1)[0];
    if (currentAttempt.completedAt) {
      return NextResponse.json(
        { error: "This attempt has already been submitted" },
        { status: 400 }
      );
    }

    if (
      assignment.quizSettings?.timeLimit &&
      !isAttemptValid(currentAttempt.startedAt, assignment.quizSettings.timeLimit)
    ) {
      return NextResponse.json(
        { error: "Time limit exceeded" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = submitQuizSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const gradeResult = gradeQuiz(
      assignment.questions || [],
      validation.data.answers
    );

    currentAttempt.answers = gradeResult.answers;
    currentAttempt.score = gradeResult.score;
    currentAttempt.completedAt = new Date();

    submission.bestScore = getBestScore(submission.quizAttempts);
    submission.grade = submission.bestScore;
    submission.status = "graded";
    submission.submittedAt = new Date();
    submission.gradedAt = new Date();

    await submission.save();

    const response: {
      score: number;
      totalPoints: number;
      percentage: number;
      bestScore: number;
      attemptNumber: number;
      answers?: typeof gradeResult.answers;
      questions?: Array<{
        id: string;
        question: string;
        options: string[];
        correctAnswer: number;
        explanation?: string;
        points: number;
      }>;
    } = {
      score: gradeResult.score,
      totalPoints: gradeResult.totalPoints,
      percentage: gradeResult.percentage,
      bestScore: submission.bestScore,
      attemptNumber: currentAttempt.attemptNumber,
    };

    if (assignment.quizSettings?.showCorrectAnswers) {
      response.answers = gradeResult.answers;
      response.questions = assignment.questions?.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        points: q.points,
      }));
    }

    return NextResponse.json(response);
  } catch (error) {
    captureException(error, { operation: "Quiz submit error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
