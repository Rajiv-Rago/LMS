"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ModelSelector,
  type ModelSelectorValue,
} from "@/components/ai/ModelSelector";
import { useUserAIDefaults } from "@/lib/hooks/useUserAIDefaults";

interface YouTubeMetadata {
  videoId: string;
  channelName: string;
  channelId: string;
  thumbnailUrl: string;
  viewCount?: number;
  publishedAt?: string;
  videoDuration?: string;
}

interface Lesson {
  _id: string;
  title: string;
  contentType: "text" | "video" | "file";
  content: string;
  videoUrl?: string;
  fileUrl?: string;
  isPublished: boolean;
  aiContext?: string;
  generationStatus?: "skeleton" | "generating" | "completed" | "failed";
  lessonOutline?: string;
  keyTakeaways?: string[];
  youtubeMetadata?: YouTubeMetadata;
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
  const [isOwnedCourse, setIsOwnedCourse] = useState(false);
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

  // AI generation state
  const [feedback, setFeedback] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [modelValue, setModelValue] = useState<ModelSelectorValue>({
    tier: "balanced",
  });
  const [showFeedback, setShowFeedback] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { value: defaultModelValue, loading: defaultsLoading } =
    useUserAIDefaults();

  useEffect(() => {
    if (!defaultsLoading) {
      setModelValue(defaultModelValue);
    }
  }, [defaultModelValue, defaultsLoading]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const fetchLesson = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/courses/${id}/modules/${moduleId}/lessons/${lessonId}`
      );
      if (!res.ok) {
        router.push(`/courses/${id}`);
        return;
      }
      const data = await res.json();
      setLesson(data.lesson);
      setPermissions(data.permissions);
      setIsOwnedCourse(!!data.isOwnedCourse);
      setFormData({
        title: data.lesson.title,
        contentType: data.lesson.contentType,
        content: data.lesson.content || "",
        videoUrl: data.lesson.videoUrl || "",
        fileUrl: data.lesson.fileUrl || "",
        aiContext: data.lesson.aiContext || "",
      });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id, moduleId, lessonId, router]);

  useEffect(() => {
    fetchLesson();
  }, [fetchLesson]);

  const handleSave = async () => {
    try {
      const res = await fetch(
        `/api/courses/${id}/modules/${moduleId}/lessons/${lessonId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify(formData),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setLesson(data.lesson);
        setEditing(false);
      }
    } catch {
      /* ignore */
    }
  };

  const handlePublish = async () => {
    try {
      const res = await fetch(
        `/api/courses/${id}/modules/${moduleId}/lessons/${lessonId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({ isPublished: !lesson?.isPublished }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setLesson(data.lesson);
      }
    } catch {
      /* ignore */
    }
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
        router.push(`/courses/${id}`);
      }
    } catch {
      /* ignore */
    }
  };

  const handleGenerate = async (withFeedback?: string) => {
    setGenError("");
    setGenerating(true);

    const payload: Record<string, string> = {};
    if (modelValue.tier) payload.tier = modelValue.tier;
    if (modelValue.provider) payload.provider = modelValue.provider;
    if (modelValue.model) payload.model = modelValue.model;
    if (withFeedback) payload.feedback = withFeedback;

    try {
      const res = await fetch(
        `/api/courses/ai/${id}/lessons/${lessonId}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error || "Generation request failed");
        setGenerating(false);
        return;
      }

      // Poll for job completion
      pollRef.current = setInterval(async () => {
        try {
          const jobRes = await fetch(`/api/jobs/${data.jobId}`);
          const jobData = await jobRes.json();
          if (jobData.job?.status === "completed") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            await fetchLesson();
            setFeedback("");
            setShowFeedback(false);
            setGenerating(false);
          } else if (jobData.job?.status === "failed") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setGenError(jobData.job.error || "Generation failed");
            setGenerating(false);
          }
        } catch {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setGenError("Failed to check generation status");
          setGenerating(false);
        }
      }, 2000);
    } catch {
      setGenError("Failed to start generation");
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!lesson) return null;

  const canGenerate = isOwnedCourse && permissions?.canEdit;
  const isSkeleton =
    lesson.generationStatus === "skeleton" || (!lesson.content && isOwnedCourse);
  const isCompleted = lesson.generationStatus === "completed";
  const isFailed = lesson.generationStatus === "failed";

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
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500"
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

            {/* Generating progress banner */}
            {generating && (
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 px-4 py-3">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-violet-600 border-t-transparent"></div>
                <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                  Generating content...
                </span>
              </div>
            )}

            {/* Generation error */}
            {genError && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-700 dark:text-red-300">
                    {genError}
                  </span>
                  <button
                    onClick={() => {
                      setGenError("");
                      handleGenerate();
                    }}
                    className="ml-4 px-3 py-1 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 rounded-md hover:bg-red-200 dark:hover:bg-red-900/60"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Skeleton state: no content generated yet */}
            {canGenerate && isSkeleton && !generating && (
              <div className="space-y-4">
                {lesson.lessonOutline && (
                  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4">
                    <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                      Lesson Outline
                    </h3>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                      {lesson.lessonOutline}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <ModelSelector
                    value={modelValue}
                    onChange={setModelValue}
                    disabled={generating}
                  />
                  <button
                    onClick={() => handleGenerate()}
                    disabled={generating}
                    className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-md hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Generate Content
                  </button>
                </div>
              </div>
            )}

            {/* Content display (for completed or content-having lessons) */}
            {!isSkeleton && (
              <>
                {/* Video */}
                {lesson.contentType === "video" && lesson.videoUrl && (
                  <div className="mb-6">
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                      <iframe
                        src={lesson.videoUrl.replace("watch?v=", "embed/")}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    </div>
                    {lesson.youtubeMetadata && (
                      <div className="mt-3 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {lesson.youtubeMetadata.channelName}
                        </span>
                        {lesson.youtubeMetadata.viewCount != null && (
                          <span>
                            {lesson.youtubeMetadata.viewCount.toLocaleString()} views
                          </span>
                        )}
                        {lesson.youtubeMetadata.videoDuration && (
                          <span>{lesson.youtubeMetadata.videoDuration}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* File */}
                {lesson.contentType === "file" && lesson.fileUrl && (
                  <div className="mb-6">
                    <a
                      href={lesson.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                    >
                      Download File
                    </a>
                  </div>
                )}

                {/* Content */}
                {lesson.content && (
                  <div
                    className={`prose dark:prose-invert max-w-none ${generating ? "opacity-50" : ""}`}
                  >
                    <div className="whitespace-pre-wrap">{lesson.content}</div>
                  </div>
                )}

                {/* Key Takeaways */}
                {lesson.keyTakeaways && lesson.keyTakeaways.length > 0 && (
                  <div className="mt-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-indigo-900 dark:text-indigo-200 mb-2">
                      Key Takeaways
                    </h3>
                    <ul className="space-y-1">
                      {lesson.keyTakeaways.map((t, i) => (
                        <li
                          key={i}
                          className="text-sm text-indigo-800 dark:text-indigo-300"
                        >
                          &bull; {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* AI feedback section for completed AI lessons */}
                {canGenerate && (isCompleted || isFailed) && !generating && (
                  <div className="mt-6 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                    <button
                      onClick={() => setShowFeedback(!showFeedback)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg"
                    >
                      <span>Improve with AI</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${showFeedback ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {showFeedback && (
                      <div className="px-4 pb-4 space-y-3 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                        <textarea
                          rows={3}
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="What would you like changed? e.g., add more examples, simplify the language, focus more on X..."
                          className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                        />
                        <ModelSelector
                          value={modelValue}
                          onChange={setModelValue}
                          disabled={generating}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleGenerate(feedback)}
                            disabled={!feedback.trim() || generating}
                            className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-md hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Regenerate with Feedback
                          </button>
                          <button
                            onClick={() => handleGenerate()}
                            disabled={generating}
                            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Regenerate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* AI Tutor Link */}
            {lesson.content && (
              <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <Link
                  href={`/courses/${id}/ai/tutor?lessonId=${lessonId}`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500"
                >
                  Ask AI Tutor about this lesson
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
