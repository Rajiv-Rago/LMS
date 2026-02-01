"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Assignment {
  _id: string;
  title: string;
  points: number;
  dueDate: string;
  assignmentType: "standard" | "quiz" | "project";
}

interface GradebookEntry {
  student: { _id: string; name: string; email: string };
  grades: {
    assignmentId: string;
    grade: number | null;
    status: string;
  }[];
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
}

interface Summary {
  totalStudents: number;
  totalAssignments: number;
  totalPossiblePoints: number;
}

export default function GradebookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [gradebook, setGradebook] = useState<GradebookEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/courses/${id}/gradebook`);

        if (!res.ok) {
          router.push(`/courses/${id}`);
          return;
        }

        const data = await res.json();
        setAssignments(data.assignments);
        setGradebook(data.gradebook);
        setSummary(data.summary);
      } catch (error) {
        console.error("Error fetching gradebook:", error);
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
    <div className="space-y-6">
      <div className="mb-6">
        <Link
          href={`/courses/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to course
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Gradebook
      </h1>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Students</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {summary.totalStudents}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Assignments
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {summary.totalAssignments}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Total Points
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {summary.totalPossiblePoints}
            </p>
          </div>
        </div>
      )}

      {/* Gradebook Table */}
      {gradebook.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            No students enrolled yet.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-50 dark:bg-zinc-800">
                    Student
                  </th>
                  {assignments.map((assignment) => (
                    <th
                      key={assignment._id}
                      className="px-4 py-3 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
                    >
                      <div className="flex items-center justify-center gap-1">
                        {assignment.title}
                        {assignment.assignmentType === "quiz" && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded normal-case">
                            Quiz
                          </span>
                        )}
                        {assignment.assignmentType === "project" && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded normal-case">
                            Project
                          </span>
                        )}
                      </div>
                      <div className="font-normal">({assignment.points})</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {gradebook.map((entry) => (
                  <tr
                    key={entry.student._id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-zinc-900">
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">
                        {entry.student.name}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {entry.student.email}
                      </div>
                    </td>
                    {assignments.map((assignment) => {
                      const gradeInfo = entry.grades.find(
                        (g) => g.assignmentId === assignment._id
                      );
                      return (
                        <td
                          key={assignment._id}
                          className="px-4 py-3 text-center whitespace-nowrap"
                        >
                          {gradeInfo?.grade !== null &&
                          gradeInfo?.grade !== undefined ? (
                            <span className="text-zinc-900 dark:text-white">
                              {gradeInfo.grade}
                            </span>
                          ) : (
                            <span
                              className={`text-xs ${
                                gradeInfo?.status === "submitted"
                                  ? "text-blue-500"
                                  : "text-zinc-400"
                              }`}
                            >
                              {gradeInfo?.status === "submitted"
                                ? "Pending"
                                : "-"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">
                        {entry.earnedPoints}/{entry.totalPoints}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {entry.percentage}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
