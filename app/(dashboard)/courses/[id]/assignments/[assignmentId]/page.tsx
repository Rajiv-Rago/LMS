"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileUploader, FileList, InstructionsViewer } from "@/components/project";

type AssignmentType = "standard" | "quiz" | "project";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  points: number;
}

interface Assignment {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  points: number;
  submissionType: "text" | "file" | "url";
  isPublished: boolean;
  assignmentType?: AssignmentType;
  questions?: QuizQuestion[];
  quizSettings?: {
    timeLimit?: number;
    shuffleQuestions: boolean;
    showCorrectAnswers: boolean;
  };
  instructions?: string;
  projectSettings?: {
    maxFiles: number;
    maxFileSize: number;
    allowedFileTypes?: string[];
  };
}

interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

interface Submission {
  _id: string;
  content?: string;
  fileUrl?: string;
  url?: string;
  status: string;
  grade?: number;
  feedback?: string;
  submittedAt?: string;
  bestScore?: number;
  files?: UploadedFile[];
}

interface Permissions {
  canEdit: boolean;
  canSubmit: boolean;
  canGrade: boolean;
}

export default function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = use(params);
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    content: "",
    url: "",
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(
          `/api/courses/${id}/assignments/${assignmentId}`
        );

        if (!res.ok) {
          router.push(`/courses/${id}/assignments`);
          return;
        }

        const data = await res.json();
        setAssignment(data.assignment);
        setSubmission(data.submission);
        setPermissions(data.permissions);

        if (data.submission) {
          setFormData({
            content: data.submission.content || "",
            url: data.submission.url || "",
          });
        }
      } catch (error) {
        console.error("Error fetching assignment:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, assignmentId, router]);

  const handleSubmit = async (asDraft: boolean) => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/courses/${id}/assignments/${assignmentId}/submissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify({
            ...formData,
            status: asDraft ? "draft" : "submitted",
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setSubmission(data.submission);
      }
    } catch (error) {
      console.error("Error submitting:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    try {
      const res = await fetch(`/api/courses/${id}/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ isPublished: !assignment?.isPublished }),
      });

      if (res.ok) {
        const data = await res.json();
        setAssignment(data.assignment);
      }
    } catch (error) {
      console.error("Error updating assignment:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!assignment) return null;

  const isPastDue = new Date(assignment.dueDate) < new Date();
  const canSubmitNow =
    permissions?.canSubmit &&
    assignment.isPublished &&
    submission?.status !== "graded";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <Link
          href={`/courses/${id}/assignments`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to assignments
        </Link>
      </div>

      {/* Assignment Details */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
                {assignment.title}
              </h1>
              {assignment.assignmentType === "quiz" && (
                <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
                  Quiz
                </span>
              )}
              {assignment.assignmentType === "project" && (
                <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                  Project
                </span>
              )}
              {!assignment.isPublished && (
                <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                  Draft
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
              <span>{assignment.points} points</span>
              <span>
                Due {new Date(assignment.dueDate).toLocaleString()}
                {isPastDue && (
                  <span className="ml-2 text-red-500">(Past due)</span>
                )}
              </span>
            </div>
          </div>

          {permissions?.canEdit && (
            <div className="flex gap-2">
              <button
                onClick={handlePublish}
                className="px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                {assignment.isPublished ? "Unpublish" : "Publish"}
              </button>
              <Link
                href={`/courses/${id}/assignments/${assignmentId}/submissions`}
                className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40"
              >
                View Submissions
              </Link>
            </div>
          )}
        </div>

        <div className="mt-4 prose dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap">{assignment.description}</p>
        </div>
      </div>

      {/* Quiz Section */}
      {assignment.assignmentType === "quiz" && permissions?.canSubmit && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
            Quiz
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">Questions:</span>{" "}
                <span className="font-medium text-zinc-900 dark:text-white">
                  {assignment.questions?.length || 0}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">Time limit:</span>{" "}
                <span className="font-medium text-zinc-900 dark:text-white">
                  {assignment.quizSettings?.timeLimit
                    ? `${assignment.quizSettings.timeLimit} minutes`
                    : "No limit"}
                </span>
              </div>
            </div>

            {submission?.bestScore !== undefined && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your best score:{" "}
                  <span className="font-semibold">
                    {submission.bestScore}/{assignment.points}
                  </span>
                </p>
              </div>
            )}

            <Link
              href={`/courses/${id}/assignments/${assignmentId}/quiz`}
              className="inline-block px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-500"
            >
              {submission?.bestScore !== undefined ? "Retake Quiz" : "Start Quiz"}
            </Link>
          </div>
        </div>
      )}

      {/* Project Section */}
      {assignment.assignmentType === "project" && permissions?.canSubmit && (
        <>
          {/* Instructions */}
          {assignment.instructions && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                Project Instructions
              </h2>
              <InstructionsViewer instructions={assignment.instructions} />
            </div>
          )}

          {/* File Upload */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Your Submission
            </h2>

            {submission?.status === "graded" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {submission.grade}/{assignment.points}
                  </div>
                  <span className="px-2 py-1 text-sm bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                    Graded
                  </span>
                </div>

                {submission.feedback && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Feedback
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                      {submission.feedback}
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Submitted Files
                  </h3>
                  <FileList
                    files={submission.files || []}
                    courseId={id}
                    assignmentId={assignmentId}
                    canDelete={false}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {submission?.status === "submitted" && (
                  <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Submitted on{" "}
                      {submission.submittedAt
                        ? new Date(submission.submittedAt).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    Uploaded Files
                  </h3>
                  <FileList
                    files={submission?.files || []}
                    courseId={id}
                    assignmentId={assignmentId}
                    canDelete={submission?.status !== "submitted"}
                    onFileDeleted={() => {
                      // Refetch to update file list
                      fetch(`/api/courses/${id}/assignments/${assignmentId}`)
                        .then((res) => res.json())
                        .then((data) => setSubmission(data.submission));
                    }}
                  />
                </div>

                {submission?.status !== "submitted" && (
                  <FileUploader
                    courseId={id}
                    assignmentId={assignmentId}
                    maxFiles={assignment.projectSettings?.maxFiles || 5}
                    maxFileSize={assignment.projectSettings?.maxFileSize || 10 * 1024 * 1024}
                    allowedFileTypes={assignment.projectSettings?.allowedFileTypes}
                    currentFileCount={submission?.files?.length || 0}
                    onUploadComplete={() => {
                      // Refetch to update file list
                      fetch(`/api/courses/${id}/assignments/${assignmentId}`)
                        .then((res) => res.json())
                        .then((data) => setSubmission(data.submission));
                    }}
                  />
                )}

                {canSubmitNow && (submission?.files?.length || 0) > 0 && submission?.status !== "submitted" && (
                  <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <button
                      onClick={() => handleSubmit(false)}
                      disabled={submitting}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:opacity-50"
                    >
                      {submitting ? "Submitting..." : "Submit Project"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Standard Submission Section */}
      {(assignment.assignmentType === "standard" || !assignment.assignmentType) && permissions?.canSubmit && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
            Your Submission
          </h2>

          {submission?.status === "graded" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {submission.grade}/{assignment.points}
                </div>
                <span className="px-2 py-1 text-sm bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                  Graded
                </span>
              </div>

              {submission.feedback && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Feedback
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                    {submission.feedback}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {submission?.status === "submitted" && (
                <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Submitted on{" "}
                    {submission.submittedAt
                      ? new Date(submission.submittedAt).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              )}

              {assignment.submissionType === "text" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Your Answer
                  </label>
                  <textarea
                    rows={8}
                    value={formData.content}
                    onChange={(e) =>
                      setFormData({ ...formData, content: e.target.value })
                    }
                    disabled={submission?.status === "submitted"}
                    className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50"
                    placeholder="Enter your answer..."
                  />
                </div>
              )}

              {assignment.submissionType === "url" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    disabled={submission?.status === "submitted"}
                    className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50"
                    placeholder="https://..."
                  />
                </div>
              )}

              {assignment.submissionType === "file" && (
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    File upload coming soon. Please submit a URL for now.
                  </p>
                </div>
              )}

              {canSubmitNow && submission?.status !== "submitted" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                  <button
                    onClick={() => handleSubmit(true)}
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                  >
                    Save Draft
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
