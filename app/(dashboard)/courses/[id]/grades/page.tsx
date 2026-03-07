"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { GraduationCap } from "lucide-react";

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
      } catch { } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, router]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-32" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2"
            >
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          ))}
        </div>
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
        <EmptyState
          icon={GraduationCap}
          title="No grades yet"
          description="Complete assignments to see your grades"
        />
      ) : (
        <div className="space-y-4">
          {grades.map(({ assignment, submission }) => {
            const isPastDue = new Date(assignment.dueDate) < new Date();

            return (
              <Link
                key={assignment._id}
                href={`/courses/${id}/assignments/${assignment._id}`}
                className="block bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 hover:border-indigo-500 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
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
                      <span className="px-2 py-1 text-sm bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded">
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
