"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Assignment {
  _id: string;
  title: string;
  points: number;
}

interface Submission {
  _id: string;
  student: { _id: string; name: string; email: string };
  status: string;
  grade?: number;
  submittedAt?: string;
  content?: string;
  url?: string;
}

export default function SubmissionsPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = use(params);
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [gradeData, setGradeData] = useState({ grade: 0, feedback: "" });
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [assignmentRes, submissionsRes] = await Promise.all([
          fetch(`/api/courses/${id}/assignments/${assignmentId}`),
          fetch(`/api/courses/${id}/assignments/${assignmentId}/submissions`),
        ]);

        if (!assignmentRes.ok || !submissionsRes.ok) {
          router.push(`/courses/${id}/assignments`);
          return;
        }

        const assignmentData = await assignmentRes.json();
        const submissionsData = await submissionsRes.json();

        setAssignment(assignmentData.assignment);
        setSubmissions(submissionsData.submissions);
      } catch { } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, assignmentId, router]);

  const handleGrade = async () => {
    if (!selectedSubmission) return;

    setGrading(true);
    try {
      const res = await fetch(
        `/api/courses/${id}/assignments/${assignmentId}/submissions/${selectedSubmission._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify(gradeData),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setSubmissions(
          submissions.map((s) =>
            s._id === selectedSubmission._id ? { ...s, ...data.submission } : s
          )
        );
        setSelectedSubmission(null);
      }
    } catch { } finally {
      setGrading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-6">
        <Link
          href={`/courses/${id}/assignments/${assignmentId}`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to assignment
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Submissions for {assignment?.title}
      </h1>

      {submissions.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            No submissions yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Submissions List */}
          <div className="space-y-2">
            {submissions.map((submission) => (
              <button
                key={submission._id}
                onClick={() => {
                  setSelectedSubmission(submission);
                  setGradeData({
                    grade: submission.grade || 0,
                    feedback: "",
                  });
                }}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedSubmission?._id === submission._id
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">
                      {submission.student.name}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {submission.student.email}
                    </p>
                  </div>
                  <div className="text-right">
                    {submission.status === "graded" ? (
                      <p className="font-medium text-zinc-900 dark:text-white">
                        {submission.grade}/{assignment?.points}
                      </p>
                    ) : (
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          submission.status === "submitted"
                            ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {submission.status}
                      </span>
                    )}
                    {submission.submittedAt && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        {new Date(submission.submittedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Grading Panel */}
          {selectedSubmission && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 h-fit sticky top-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                {selectedSubmission.student.name}&apos;s Submission
              </h2>

              {/* Submission Content */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Submission
                </h3>
                {selectedSubmission.content ? (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-md">
                    <p className="text-zinc-900 dark:text-white whitespace-pre-wrap">
                      {selectedSubmission.content}
                    </p>
                  </div>
                ) : selectedSubmission.url ? (
                  <a
                    href={selectedSubmission.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline break-all"
                  >
                    {selectedSubmission.url}
                  </a>
                ) : (
                  <p className="text-zinc-500 dark:text-zinc-400">
                    No content submitted
                  </p>
                )}
              </div>

              {/* Grading Form */}
              {selectedSubmission.status === "submitted" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Grade (out of {assignment?.points})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={assignment?.points}
                      value={gradeData.grade}
                      onChange={(e) =>
                        setGradeData({
                          ...gradeData,
                          grade: parseInt(e.target.value) || 0,
                        })
                      }
                      className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Feedback (optional)
                    </label>
                    <textarea
                      rows={4}
                      value={gradeData.feedback}
                      onChange={(e) =>
                        setGradeData({ ...gradeData, feedback: e.target.value })
                      }
                      className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      placeholder="Provide feedback..."
                    />
                  </div>

                  <button
                    onClick={handleGrade}
                    disabled={grading}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {grading ? "Saving..." : "Save Grade"}
                  </button>
                </div>
              )}

              {selectedSubmission.status === "graded" && (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Already graded: {selectedSubmission.grade}/{assignment?.points}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
