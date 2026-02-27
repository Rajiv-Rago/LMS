"use client";

import Link from "next/link";
import QuestionCard from "./QuestionCard";

interface Answer {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
  pointsEarned: number;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  points: number;
}

interface QuizResultsProps {
  score: number;
  totalPoints: number;
  percentage: number;
  bestScore: number;
  attemptNumber: number;
  answers?: Answer[];
  questions?: Question[];
  showCorrectAnswers: boolean;
  courseId: string;
  assignmentId: string;
  onRetake?: () => void;
}

export default function QuizResults({
  score,
  totalPoints,
  percentage,
  bestScore,
  attemptNumber,
  answers,
  questions,
  showCorrectAnswers,
  courseId,
  assignmentId,
  onRetake,
}: QuizResultsProps) {
  // Determine performance level for styling
  const getPerformanceLevel = (pct: number) => {
    if (pct >= 90) return { label: "Excellent!", color: "green" };
    if (pct >= 80) return { label: "Great job!", color: "blue" };
    if (pct >= 70) return { label: "Good work", color: "yellow" };
    if (pct >= 60) return { label: "Keep trying", color: "orange" };
    return { label: "Needs improvement", color: "red" };
  };

  const performance = getPerformanceLevel(percentage);

  const performanceColors: Record<string, string> = {
    green: "text-green-600 dark:text-green-400",
    blue: "text-indigo-600 dark:text-indigo-400",
    yellow: "text-yellow-600 dark:text-yellow-400",
    orange: "text-orange-600 dark:text-orange-400",
    red: "text-red-600 dark:text-red-400",
  };

  const bgColors: Record<string, string> = {
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    blue: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800",
    yellow: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
    orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  };

  return (
    <div className="space-y-6">
      {/* Score Summary Card */}
      <div
        className={`rounded-lg border p-6 ${bgColors[performance.color]}`}
      >
        <div className="text-center">
          <p className={`text-lg font-medium ${performanceColors[performance.color]}`}>
            {performance.label}
          </p>
          <div className="mt-2">
            <span className="text-5xl font-bold text-zinc-900 dark:text-white">
              {score}
            </span>
            <span className="text-2xl text-zinc-500 dark:text-zinc-400">
              /{totalPoints}
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-700 dark:text-zinc-300">
            {percentage}%
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Attempt #{attemptNumber}
          </p>
        </div>

        {/* Best Score Banner */}
        {bestScore > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your best score:{" "}
              <span className="font-semibold text-zinc-900 dark:text-white">
                {bestScore}/{totalPoints}
              </span>
            </p>
            {score >= bestScore && score > 0 && (
              <p className="mt-1 text-sm text-green-600 dark:text-green-400 font-medium">
                New personal best!
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        {onRetake && (
          <button
            onClick={onRetake}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500"
          >
            Retake Quiz
          </button>
        )}
        <Link
          href={`/courses/${courseId}/assignments/${assignmentId}`}
          className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
        >
          Back to Assignment
        </Link>
      </div>

      {/* Detailed Results */}
      {showCorrectAnswers && answers && questions && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Question Review
          </h2>
          {questions.map((question, index) => {
            const answer = answers.find((a) => a.questionId === question.id);
            return (
              <QuestionCard
                key={question.id}
                questionNumber={index + 1}
                question={question.question}
                options={question.options}
                points={question.points}
                selectedAnswer={answer?.selectedAnswer ?? null}
                onAnswerSelect={() => {}}
                disabled
                showResults
                correctAnswer={question.correctAnswer}
                isCorrect={answer?.isCorrect}
                explanation={question.explanation}
              />
            );
          })}
        </div>
      )}

      {!showCorrectAnswers && (
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Detailed answer review is not available for this quiz.
          </p>
        </div>
      )}
    </div>
  );
}
