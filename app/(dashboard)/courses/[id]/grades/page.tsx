"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface GradeEntry {
  assignment: {
    _id: string;
    title: string;
    points: number;
    dueDate: string;
  };
  submission: {
    _id: string;
    status: string;
    grade?: number;
    feedback?: string;
    submittedAt?: string;
    gradedAt?: string;
  } | null;
}

interface Summary {
  totalAssignments: number;
  submittedCount: number;
  gradedCount: number;
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
}

export default function StudentGradesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/courses/${id}/grades`);

        if (!res.ok) {
          router.push(`/courses/${id}`);
          return;
        }

        const data = await res.json();
        setGrades(data.grades);
        setSummary(data.summary);
      } catch (error) {
        console.error("Error fetching grades:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <Link
          href={`/courses/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to course
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        My Grades
      </h1>

      {/* Summary */}
      {summary && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Total Grade
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                {summary.percentage}%
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Points</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                {summary.earnedPoints}/{summary.totalPoints}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Submitted
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                {summary.submittedCount}/{summary.totalAssignments}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Graded</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                {summary.gradedCount}/{summary.totalAssignments}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grades List */}
      {grades.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            No assignments in this course yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grades.map(({ assignment, submission }) => {
            const isPastDue = new Date(assignment.dueDate) < new Date();

            return (
              <Link
                key={assignment._id}
                href={`/courses/${id}/assignments/${assignment._id}`}
                className="block bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 hover:border-blue-500 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-white">
                      {assignment.title}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Due {new Date(assignment.dueDate).toLocaleDateString()}
                      {isPastDue && !submission && (
                        <span className="ml-2 text-red-500">Missing</span>
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    {submission?.status === "graded" ? (
                      <div>
                        <p className="text-lg font-bold text-zinc-900 dark:text-white">
                          {submission.grade}/{assignment.points}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {Math.round(
                            ((submission.grade || 0) / assignment.points) * 100
                          )}
                          %
                        </p>
                      </div>
                    ) : submission ? (
                      <span className="px-2 py-1 text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                        {submission.status === "submitted"
                          ? "Submitted"
                          : "Draft"}
                      </span>
                    ) : (
                      <span className="text-zinc-400">-/{assignment.points}</span>
                    )}
                  </div>
                </div>

                {submission?.feedback && (
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Feedback:
                    </p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {submission.feedback}
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
