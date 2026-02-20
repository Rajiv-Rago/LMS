"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Lesson {
  _id: string;
  title: string;
  contentType: "text" | "video" | "file";
  content: string;
  videoUrl?: string;
  fileUrl?: string;
  isPublished: boolean;
  aiContext?: string;
}

interface Permissions {
  canEdit: boolean;
}

export default function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string; lessonId: string }>;
}) {
  const { id, moduleId, lessonId } = use(params);
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    contentType: "text" as "text" | "video" | "file",
    content: "",
    videoUrl: "",
    fileUrl: "",
    aiContext: "",
  });

  useEffect(() => {
    async function fetchLesson() {
      try {
        const res = await fetch(
          `/api/courses/${id}/modules/${moduleId}/lessons/${lessonId}`
        );
        if (!res.ok) {
          router.push(`/courses/${id}/modules/${moduleId}`);
          return;
        }
        const data = await res.json();
        setLesson(data.lesson);
        setPermissions(data.permissions);
        setFormData({
          title: data.lesson.title,
          contentType: data.lesson.contentType,
          content: data.lesson.content || "",
          videoUrl: data.lesson.videoUrl || "",
          fileUrl: data.lesson.fileUrl || "",
          aiContext: data.lesson.aiContext || "",
        });
      } catch { } finally {
        setLoading(false);
      }
    }
    fetchLesson();
  }, [id, moduleId, lessonId, router]);

  const handleSave = async () => {
    try {
      const res = await fetch(
        `/api/courses/${id}/modules/${moduleId}/lessons/${lessonId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify(formData),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setLesson(data.lesson);
        setEditing(false);
      }
    } catch { }
  };

  const handlePublish = async () => {
    try {
      const res = await fetch(
        `/api/courses/${id}/modules/${moduleId}/lessons/${lessonId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify({ isPublished: !lesson?.isPublished }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setLesson(data.lesson);
      }
    } catch { }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this lesson?")) return;

    try {
      const res = await fetch(
        `/api/courses/${id}/modules/${moduleId}/lessons/${lessonId}`,
        {
          method: "DELETE",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        }
      );

      if (res.ok) {
        router.push(`/courses/${id}/modules/${moduleId}`);
      }
    } catch { }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!lesson) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <Link
          href={`/courses/${id}/modules/${moduleId}`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to module
        </Link>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        {editing && permissions?.canEdit ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Content Type
              </label>
              <select
                value={formData.contentType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contentType: e.target.value as "text" | "video" | "file",
                  })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              >
                <option value="text">Text</option>
                <option value="video">Video</option>
                <option value="file">File</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Content
              </label>
              <textarea
                rows={10}
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono text-sm"
                placeholder="Enter lesson content (supports markdown)"
              />
            </div>

            {formData.contentType === "video" && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Video URL
                </label>
                <input
                  type="url"
                  value={formData.videoUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, videoUrl: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
            )}

            {formData.contentType === "file" && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  File URL
                </label>
                <input
                  type="url"
                  value={formData.fileUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, fileUrl: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  placeholder="https://example.com/file.pdf"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                AI Context (for AI Tutor)
              </label>
              <textarea
                rows={3}
                value={formData.aiContext}
                onChange={(e) =>
                  setFormData({ ...formData, aiContext: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                placeholder="Additional context for the AI tutor about this lesson..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
                    {lesson.title}
                  </h1>
                  {!lesson.isPublished && (
                    <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                      Draft
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 capitalize">
                  {lesson.contentType} content
                </p>
              </div>
              {permissions?.canEdit && (
                <div className="flex gap-2">
                  <button
                    onClick={handlePublish}
                    className="px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    {lesson.isPublished ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    onClick={() => setEditing(true)}
                    className="px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            {/* Video */}
            {lesson.contentType === "video" && lesson.videoUrl && (
              <div className="mb-6 aspect-video bg-black rounded-lg overflow-hidden">
                <iframe
                  src={lesson.videoUrl.replace("watch?v=", "embed/")}
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
            )}

            {/* File */}
            {lesson.contentType === "file" && lesson.fileUrl && (
              <div className="mb-6">
                <a
                  href={lesson.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40"
                >
                  Download File
                </a>
              </div>
            )}

            {/* Content */}
            {lesson.content && (
              <div className="prose dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap">{lesson.content}</div>
              </div>
            )}

            {/* AI Tutor Link */}
            <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
              <Link
                href={`/courses/${id}/ai/tutor?lessonId=${lessonId}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
              >
                Ask AI Tutor about this lesson
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
