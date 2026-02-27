"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ModelSelector, ModelSelectorValue } from "@/components/ai/ModelSelector";
import { useUserAIDefaults } from "@/lib/hooks/useUserAIDefaults";

interface Lesson {
  _id: string;
  title: string;
}

interface Module {
  _id: string;
  title: string;
  lessons: Lesson[];
}

interface GeneratedContent {
  _id: string;
  title: string;
  contentType: string;
  content: string;
  approvalStatus: string;
  createdAt: string;
  lesson?: { title: string };
}

export default function AIGeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [modules, setModules] = useState<Module[]>([]);
  const [contents, setContents] = useState<GeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedContent, setSelectedContent] = useState<GeneratedContent | null>(null);

  const [formData, setFormData] = useState({
    lessonId: "",
    contentType: "quiz" as "quiz" | "summary" | "practice" | "flashcards",
    numQuestions: 5,
  });
  const userDefaults = useUserAIDefaults();
  const [modelValue, setModelValue] = useState<ModelSelectorValue>({
    tier: "balanced",
  });

  useEffect(() => {
    if (!userDefaults.loading) {
      setModelValue(userDefaults.value);
    }
  }, [userDefaults.loading, userDefaults.value]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [modulesRes, contentsRes] = await Promise.all([
          fetch(`/api/courses/${id}/modules`),
          fetch(`/api/ai/generate?courseId=${id}`),
        ]);

        if (modulesRes.ok) {
          const modulesData = await modulesRes.json();
          setModules(modulesData.modules);
        }

        if (contentsRes.ok) {
          const contentsData = await contentsRes.json();
          setContents(contentsData.contents);
        }
      } catch { } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({
          courseId: id,
          lessonId: formData.lessonId || undefined,
          contentType: formData.contentType,
          tier: modelValue.tier || undefined,
          provider: modelValue.provider || undefined,
          model: modelValue.model || undefined,
          options: {
            numQuestions: formData.numQuestions,
            numProblems: formData.numQuestions,
            numCards: formData.numQuestions * 2,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setContents([data.content, ...contents]);
        setSelectedContent(data.content);
      }
    } catch { } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (contentId: string, status: "approved" | "rejected") => {
    try {
      const res = await fetch(`/api/ai/generate/${contentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        const data = await res.json();
        setContents(
          contents.map((c) =>
            c._id === contentId ? { ...c, ...data.content } : c
          )
        );
        if (selectedContent?._id === contentId) {
          setSelectedContent({ ...selectedContent, ...data.content });
        }
      }
    } catch { }
  };

  const handleDelete = async (contentId: string) => {
    if (!confirm("Are you sure you want to delete this content?")) return;

    try {
      const res = await fetch(`/api/ai/generate/${contentId}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      if (res.ok) {
        setContents(contents.filter((c) => c._id !== contentId));
        if (selectedContent?._id === contentId) {
          setSelectedContent(null);
        }
      }
    } catch { }
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
          href={`/courses/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to course
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        AI Content Generator
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator Form */}
        <div className="lg:col-span-1">
          <form
            onSubmit={handleGenerate}
            className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 space-y-4"
          >
            <h2 className="font-semibold text-zinc-900 dark:text-white">
              Generate Content
            </h2>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Lesson (optional)
              </label>
              <select
                value={formData.lessonId}
                onChange={(e) =>
                  setFormData({ ...formData, lessonId: e.target.value })
                }
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              >
                <option value="">All course content</option>
                {modules.map((module) => (
                  <optgroup key={module._id} label={module.title}>
                    {module.lessons.map((lesson) => (
                      <option key={lesson._id} value={lesson._id}>
                        {lesson.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Content Type
              </label>
              <select
                value={formData.contentType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contentType: e.target.value as typeof formData.contentType,
                  })
                }
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              >
                <option value="quiz">Quiz</option>
                <option value="summary">Summary</option>
                <option value="practice">Practice Problems</option>
                <option value="flashcards">Flashcards</option>
              </select>
            </div>

            {(formData.contentType === "quiz" ||
              formData.contentType === "practice") && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Number of Questions
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.numQuestions}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      numQuestions: parseInt(e.target.value),
                    })
                  }
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>
            )}

            <ModelSelector
              value={modelValue}
              onChange={setModelValue}
              disabled={generating}
            />

            <button
              type="submit"
              disabled={generating}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </form>

          {/* Generated Content List */}
          <div className="mt-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
              Generated Content
            </h3>

            {contents.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No generated content yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {contents.map((content) => (
                  <li key={content._id}>
                    <button
                      onClick={() => setSelectedContent(content)}
                      className={`w-full text-left p-3 rounded-md ${
                        selectedContent?._id === content._id
                          ? "bg-indigo-50 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                          {content.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            content.approvalStatus === "approved"
                              ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                              : content.approvalStatus === "rejected"
                              ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                              : "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300"
                          }`}
                        >
                          {content.approvalStatus}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize mt-1">
                        {content.contentType} &bull;{" "}
                        {new Date(content.createdAt).toLocaleDateString()}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Content Preview */}
        <div className="lg:col-span-2">
          {selectedContent ? (
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {selectedContent.title}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 capitalize">
                    {selectedContent.contentType}
                    {selectedContent.lesson && ` - ${selectedContent.lesson.title}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedContent.approvalStatus === "pending" && (
                    <>
                      <button
                        onClick={() =>
                          handleApprove(selectedContent._id, "approved")
                        }
                        className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-500"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          handleApprove(selectedContent._id, "rejected")
                        }
                        className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-500"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(selectedContent._id)}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="prose dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm bg-zinc-50 dark:bg-zinc-800 p-4 rounded-md overflow-x-auto">
                  {selectedContent.content}
                </pre>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-12 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                Select generated content to preview, or generate new content.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
