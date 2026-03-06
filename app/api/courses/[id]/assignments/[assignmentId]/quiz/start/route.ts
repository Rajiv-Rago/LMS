import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Course, Assignment, Submission } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import {
  isAttemptValid,
  getRemainingTime,
  shuffleArray,
} from "@/lib/utils/quizGrader";
import { captureException } from "@/lib/logger";

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

    const perms = await getCoursePermissions(course, user);

    if (!perms.isEnrolled) {
      return NextResponse.json(
        { error: "You must be enrolled to take quizzes" },
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

    if (!assignment.isPublished) {
      return NextResponse.json(
        { error: "Quiz not available" },
        { status: 400 }
      );
    }

    let submission = await Submission.findOne({
      assignment: assignmentId,
      student: user.userId,
    });

    const attemptNumber = submission?.quizAttempts?.length
      ? submission.quizAttempts.length + 1
      : 1;

    // Check if there's an incomplete attempt
    const lastAttempt = submission?.quizAttempts?.slice(-1)[0];
    if (lastAttempt && !lastAttempt.completedAt) {
      if (
        assignment.quizSettings?.timeLimit &&
        !isAttemptValid(lastAttempt.startedAt, assignment.quizSettings.timeLimit)
      ) {
        // Auto-close the expired attempt
        lastAttempt.completedAt = new Date();
        lastAttempt.score = 0;
        lastAttempt.answers = assignment.questions?.map((q) => ({
          questionId: q.id,
          selectedAnswer: -1,
          isCorrect: false,
          pointsEarned: 0,
        })) || [];
        await submission?.save();
      } else {
        // Return the existing incomplete attempt
        const questions = assignment.quizSettings?.shuffleQuestions
          ? shuffleArray(assignment.questions || [])
          : assignment.questions || [];

        const studentQuestions = questions.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          points: q.points,
        }));

        return NextResponse.json({
          attempt: {
            attemptNumber: lastAttempt.attemptNumber,
            startedAt: lastAttempt.startedAt,
            remainingTime: getRemainingTime(
              lastAttempt.startedAt,
              assignment.quizSettings?.timeLimit
            ),
          },
          questions: studentQuestions,
          totalPoints: assignment.points,
        });
      }
    }

    // Create new attempt
    const newAttempt = {
      attemptNumber,
      answers: [],
      score: 0,
      startedAt: new Date(),
    };

    if (!submission) {
      submission = await Submission.create({
        assignment: assignmentId,
        student: user.userId,
        status: "draft",
        quizAttempts: [newAttempt],
      });
    } else {
      submission.quizAttempts = submission.quizAttempts || [];
      submission.quizAttempts.push(newAttempt);
      await submission.save();
    }

    const questions = assignment.quizSettings?.shuffleQuestions
      ? shuffleArray(assignment.questions || [])
      : assignment.questions || [];

    const studentQuestions = questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      points: q.points,
    }));

    return NextResponse.json({
      attempt: {
        attemptNumber,
        startedAt: newAttempt.startedAt,
        remainingTime: getRemainingTime(
          newAttempt.startedAt,
          assignment.quizSettings?.timeLimit
        ),
      },
      questions: studentQuestions,
      totalPoints: assignment.points,
    });
  } catch (error) {
    captureException(error, { operation: "Quiz start error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
