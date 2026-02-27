"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QuestionCard, QuizTimer, QuizResults } from "@/components/quiz";

interface Question {
  id: string;
  question: string;
  options: string[];
  points: number;
}

interface QuizAttempt {
  attemptNumber: number;
  startedAt: string;
  remainingTime: number | null;
}

interface QuizInfo {
  title: string;
  description: string;
  points: number;
  dueDate: string;
  questionCount: number;
  timeLimit?: number;
  showCorrectAnswers: boolean;
}

interface AttemptSummary {
  attemptNumber: number;
  score: number;
  startedAt: string;
  completedAt?: string;
}

interface QuizResult {
  score: number;
  totalPoints: number;
  percentage: number;
  bestScore: number;
  attemptNumber: number;
  answers?: Array<{
    questionId: string;
    selectedAnswer: number;
    isCorrect: boolean;
    pointsEarned: number;
  }>;
  questions?: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
    points: number;
  }>;
}

export default function QuizPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = use(params);
  const router = useRouter();

  // Quiz info (before starting)
  const [quizInfo, setQuizInfo] = useState<QuizInfo | null>(null);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [bestScore, setBestScore] = useState<number | null>(null);

  // Active quiz state
  const [currentAttempt, setCurrentAttempt] = useState<QuizAttempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  // Results state
  const [result, setResult] = useState<QuizResult | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch quiz info
  useEffect(() => {
    async function fetchQuizInfo() {
      try {
        const res = await fetch(
          `/api/courses/${id}/assignments/${assignmentId}/quiz`
        );
        if (!res.ok) {
          if (res.status === 404) {
            router.push(`/courses/${id}/assignments/${assignmentId}`);
            return;
          }
          throw new Error("Failed to fetch quiz");
        }

        const data = await res.json();

        // If instructor view, redirect to assignment page
        if (data.isInstructor) {
          router.push(`/courses/${id}/assignments/${assignmentId}`);
          return;
        }

        setQuizInfo(data.quiz);
        setAttempts(data.attempts || []);
        setBestScore(data.bestScore);
      } catch (_err) {        setError("Failed to load quiz");
      } finally {
        setLoading(false);
      }
    }
    fetchQuizInfo();
  }, [id, assignmentId, router]);

  // Start or continue quiz
  const startQuiz = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/courses/${id}/assignments/${assignmentId}/quiz?action=start`,
        { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest" } }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start quiz");
      }

      const data = await res.json();
      setCurrentAttempt(data.attempt);
      setQuestions(data.questions);
      setAnswers({});
    } catch (err) {      setError(err instanceof Error ? err.message : "Failed to start quiz");
    } finally {
      setLoading(false);
    }
  }, [id, assignmentId]);

  // Submit quiz
  const submitQuiz = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/courses/${id}/assignments/${assignmentId}/quiz?action=submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify({ answers }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit quiz");
      }

      const data = await res.json();
      setResult(data);
      setCurrentAttempt(null);
    } catch (err) {      setError(err instanceof Error ? err.message : "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  }, [id, assignmentId, answers]);

  // Handle time up
  const handleTimeUp = useCallback(() => {
    submitQuiz();
  }, [submitQuiz]);

  // Handle retake
  const handleRetake = () => {
    setResult(null);
    startQuiz();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Error state
  if (error && !currentAttempt && !result) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg p-4">
          <p>{error}</p>
          <Link
            href={`/courses/${id}/assignments/${assignmentId}`}
            className="mt-4 inline-block text-sm underline"
          >
            Back to assignment
          </Link>
        </div>
      </div>
    );
  }

  // Show results
  if (result) {
    return (
      <div className="max-w-3xl mx-auto">
        <QuizResults
          score={result.score}
          totalPoints={result.totalPoints}
          percentage={result.percentage}
          bestScore={result.bestScore}
          attemptNumber={result.attemptNumber}
          answers={result.answers}
          questions={result.questions}
          showCorrectAnswers={!!result.questions}
          courseId={id}
          assignmentId={assignmentId}
          onRetake={handleRetake}
        />
      </div>
    );
  }

  // Active quiz
  if (currentAttempt && questions.length > 0) {
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="max-w-3xl mx-auto pb-24">
        {/* Timer */}
        {currentAttempt.remainingTime !== null && (
          <QuizTimer
            initialSeconds={currentAttempt.remainingTime}
            onTimeUp={handleTimeUp}
          />
        )}

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Progress: {answeredCount}/{questions.length} answered
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Attempt #{currentAttempt.attemptNumber}
            </span>
          </div>
          <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{
                width: `${(answeredCount / questions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              questionNumber={index + 1}
              question={question.question}
              options={question.options}
              points={question.points}
              selectedAnswer={answers[question.id] ?? null}
              onAnswerSelect={(answerIndex) =>
                setAnswers({ ...answers, [question.id]: answerIndex })
              }
            />
          ))}
        </div>

        {/* Submit button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {answeredCount === questions.length
                ? "All questions answered"
                : `${questions.length - answeredCount} questions remaining`}
            </span>
            <button
              onClick={submitQuiz}
              disabled={submitting}
              className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Quiz"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz info / start screen
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="mb-6">
        <Link
          href={`/courses/${id}/assignments/${assignmentId}`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to assignment
        </Link>
      </div>

      {quizInfo && (
        <>
          {/* Quiz Info Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {quizInfo.title}
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {quizInfo.description}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Questions
                </p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {quizInfo.questionCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Total Points
                </p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {quizInfo.points}
                </p>
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Time Limit
                </p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {quizInfo.timeLimit
                    ? `${quizInfo.timeLimit} minutes`
                    : "No limit"}
                </p>
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Due Date
                </p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {new Date(quizInfo.dueDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            {bestScore !== null && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your best score:{" "}
                  <span className="font-semibold">
                    {bestScore}/{quizInfo.points}
                  </span>
                </p>
              </div>
            )}

            <button
              onClick={startQuiz}
              className="mt-6 w-full px-4 py-3 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500"
            >
              {attempts.length === 0 ? "Start Quiz" : "Start New Attempt"}
            </button>
          </div>

          {/* Previous Attempts */}
          {attempts.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                Previous Attempts
              </h2>
              <div className="space-y-3">
                {attempts.map((attempt) => (
                  <div
                    key={attempt.attemptNumber}
                    className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-white">
                        Attempt #{attempt.attemptNumber}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {attempt.completedAt
                          ? new Date(attempt.completedAt).toLocaleString()
                          : "In progress"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        {attempt.score}/{quizInfo.points}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {Math.round((attempt.score / quizInfo.points) * 100)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quiz Guidelines */}
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
            <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
              Guidelines
            </h3>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
              <li>You can retake this quiz unlimited times.</li>
              <li>Your best score will be recorded in the gradebook.</li>
              {quizInfo.timeLimit && (
                <li>
                  You have {quizInfo.timeLimit} minutes to complete the quiz.
                </li>
              )}
              {quizInfo.showCorrectAnswers && (
                <li>Correct answers will be shown after submission.</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
