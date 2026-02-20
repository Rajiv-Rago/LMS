import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Assignment, Submission } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import {
  gradeQuiz,
  getBestScore,
  isAttemptValid,
  getRemainingTime,
  shuffleArray,
} from "@/lib/utils/quizGrader";
import { captureException } from "@/lib/logger";

const submitQuizSchema = z.object({
  answers: z.record(z.string(), z.number()), // questionId -> selectedAnswer index
});

// POST /api/courses/[id]/assignments/[assignmentId]/quiz
// Actions: start (start new attempt) or submit (submit answers)
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

    const url = new URL(request.url);
    const action = url.searchParams.get("action");

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

    // Get or create submission
    let submission = await Submission.findOne({
      assignment: assignmentId,
      student: user.userId,
    });

    if (action === "start") {
      // Start a new quiz attempt
      const attemptNumber = submission?.quizAttempts?.length
        ? submission.quizAttempts.length + 1
        : 1;

      // Check if there's an incomplete attempt
      const lastAttempt = submission?.quizAttempts?.slice(-1)[0];
      if (lastAttempt && !lastAttempt.completedAt) {
        // Check if the attempt has expired
        if (
          assignment.quizSettings?.timeLimit &&
          !isAttemptValid(lastAttempt.startedAt, assignment.quizSettings.timeLimit)
        ) {
          // Auto-submit the expired attempt with empty answers
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

          // Strip correct answers for student view
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

      // Prepare questions (shuffle if enabled, strip correct answers)
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
    } else if (action === "submit") {
      // Submit quiz answers
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

      // Check time limit
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

      // Grade the quiz
      const gradeResult = gradeQuiz(
        assignment.questions || [],
        validation.data.answers
      );

      // Update the attempt
      currentAttempt.answers = gradeResult.answers;
      currentAttempt.score = gradeResult.score;
      currentAttempt.completedAt = new Date();

      // Update best score
      submission.bestScore = getBestScore(submission.quizAttempts);

      // Set grade to best score (for gradebook integration)
      submission.grade = submission.bestScore;
      submission.status = "graded";
      submission.submittedAt = new Date();
      submission.gradedAt = new Date();

      await submission.save();

      // Prepare response
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

      // Include detailed results if showCorrectAnswers is enabled
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
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use ?action=start or ?action=submit" },
        { status: 400 }
      );
    }
  } catch (error) {
    captureException(error, { operation: "Quiz error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/courses/[id]/assignments/[assignmentId]/quiz
// Get quiz status and previous attempts for a student
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

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      course: id,
      assignmentType: "quiz",
    });

    if (!assignment) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const isInstructor = course.instructor.toString() === user.userId;
    const isAdmin = user.role === "admin";
    const isEnrolled = course.enrolledStudents.some(
      (s: { toString: () => string }) => s.toString() === user.userId
    );

    if (!isInstructor && !isAdmin && !isEnrolled) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // For instructors/admins, return full quiz details
    if (isInstructor || isAdmin) {
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
    const hasActiveAttempt = lastAttempt && !lastAttempt.completedAt;

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
