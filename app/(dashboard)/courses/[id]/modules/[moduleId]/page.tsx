"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Lesson {
  _id: string;
  title: string;
  contentType: string;
  order: number;
  isPublished: boolean;
}

interface Module {
  _id: string;
  title: string;
  description?: string;
  order: number;
  isPublished: boolean;
  lessons: Lesson[];
}

export default function ModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id, moduleId } = use(params);
  const router = useRouter();
  const [module, setModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "" });
  const [showNewLesson, setShowNewLesson] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");

  useEffect(() => {
    async function fetchModule() {
      try {
        const res = await fetch(`/api/courses/${id}/modules/${moduleId}`);
        if (!res.ok) {
          router.push(`/courses/${id}`);
          return;
        }
        const data = await res.json();
        setModule(data.module);
        setFormData({
          title: data.module.title,
          description: data.module.description || "",
        });
      } catch { } finally {
        setLoading(false);
      }
    }
    fetchModule();
  }, [id, moduleId, router]);

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/courses/${id}/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        setModule((prev) => (prev ? { ...prev, ...data.module } : null));
        setEditing(false);
      }
    } catch { }
  };

  const handlePublish = async () => {
    try {
      const res = await fetch(`/api/courses/${id}/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ isPublished: !module?.isPublished }),
      });

      if (res.ok) {
        const data = await res.json();
        setModule((prev) => (prev ? { ...prev, ...data.module } : null));
      }
    } catch { }
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(
        `/api/courses/${id}/modules/${moduleId}/lessons`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify({ title: newLessonTitle }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setModule((prev) =>
          prev
            ? { ...prev, lessons: [...prev.lessons, data.lesson] }
            : null
        );
        setNewLessonTitle("");
        setShowNewLesson(false);
      }
    } catch { }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this module?")) return;

    try {
      const res = await fetch(`/api/courses/${id}/modules/${moduleId}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      if (res.ok) {
        router.push(`/courses/${id}`);
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

  if (!module) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="mb-6">
        <Link
          href={`/courses/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to course
        </Link>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        {editing ? (
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
                Description
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
              >
                Save
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
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
                    {module.title}
                  </h1>
                  {!module.isPublished && (
                    <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                      Draft
                    </span>
                  )}
                </div>
                {module.description && (
                  <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                    {module.description}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePublish}
                  className="px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  {module.isPublished ? "Unpublish" : "Publish"}
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
            </div>
          </>
        )}
      </div>

      {/* Lessons */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Lessons
          </h2>
          <button
            onClick={() => setShowNewLesson(true)}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            + Add Lesson
          </button>
        </div>

        {showNewLesson && (
          <form
            onSubmit={handleAddLesson}
            className="mb-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4"
          >
            <input
              type="text"
              value={newLessonTitle}
              onChange={(e) => setNewLessonTitle(e.target.value)}
              placeholder="Lesson title"
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
              >
                Add Lesson
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewLesson(false);
                  setNewLessonTitle("");
                }}
                className="px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {module.lessons.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              No lessons in this module yet.
            </p>
          </div>
        ) : (
          <ul className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
            {module.lessons.map((lesson) => (
              <li key={lesson._id}>
                <Link
                  href={`/courses/${id}/modules/${moduleId}/lessons/${lesson._id}`}
                  className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-400">
                      {lesson.contentType === "video" ? "▶" : "📄"}
                    </span>
                    <span className="text-zinc-900 dark:text-white">
                      {lesson.title}
                    </span>
                    {!lesson.isPublished && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                        Draft
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-zinc-500">Edit &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
