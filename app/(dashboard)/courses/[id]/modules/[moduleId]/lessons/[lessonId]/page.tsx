"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  ModelSelector,
  type ModelSelectorValue,
} from "@/components/ai/ModelSelector";
import { useUserAIDefaults } from "@/lib/hooks/useUserAIDefaults";
import MarkdownContent from "@/components/ui/MarkdownContent";
import YouTubeVideoPicker from "@/components/lesson/YouTubeVideoPicker";
import ContentGenerationSkeleton from "@/components/lesson/ContentGenerationSkeleton";
import FeedbackSection from "@/components/lesson/FeedbackSection";
import Button from "@/components/ui/Button";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { useToast } from "@/lib/hooks/useToast";

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
  isSharedWith: boolean;
}

interface ModuleLesson {
  _id: string;
  title: string;
}

interface ModuleData {
  _id: string;
  title: string;
  lessons: ModuleLesson[];
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
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [moduleNavOpen, setModuleNavOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    contentType: "text" as "text" | "video" | "file",
    content: "",
    videoUrl: "",
    fileUrl: "",
    aiContext: "",
  });

  // AI generation state
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [modelValue, setModelValue] = useState<ModelSelectorValue>({
    tier: "balanced",
  });
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  const { value: defaultModelValue, loading: defaultsLoading } =
    useUserAIDefaults();

  useEffect(() => {
    if (!defaultsLoading) {
      setModelValue(defaultModelValue);
    }
  }, [defaultModelValue, defaultsLoading]);

  // Cleanup polling and undo timer on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const fetchLesson = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/courses/${id}/modules/${moduleId}/lessons/${lessonId}`
      );
      if (!res.ok) {
        router.push(`/courses/${id}/overview`);
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

  // Fetch modules for sidebar navigation
  useEffect(() => {
    async function fetchModules() {
      try {
        const res = await fetch(`/api/courses/${id}/modules`);
        if (res.ok) {
          const data = await res.json();
          setModules(data.modules || []);
        }
      } catch {
        /* ignore */
      }
    }
    fetchModules();
  }, [id]);

  // Fetch AI credits when permissions are available
  useEffect(() => {
    const canFeedback =
      isOwnedCourse && (permissions?.canEdit || permissions?.isSharedWith);
    if (!canFeedback) return;

    fetch("/api/ai/credits")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.remaining != null) setCreditsRemaining(data.remaining);
      })
      .catch(() => {});
  }, [isOwnedCourse, permissions]);

  const patchLesson = async (body: Record<string, unknown>) => {
    const res = await fetch(
      `/api/courses/${id}/modules/${moduleId}/lessons/${lessonId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(body),
      }
    );
    if (res.ok) {
      const data = await res.json();
      setLesson(data.lesson);
    }
    return res;
  };

  const handleSave = async () => {
    try {
      const res = await patchLesson(formData);
      if (res.ok) setEditing(false);
    } catch {
      /* ignore */
    }
  };

  const handlePublish = async () => {
    try {
      await patchLesson({ isPublished: !lesson?.isPublished });
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
        router.push(`/courses/${id}/overview`);
      }
    } catch {
      /* ignore */
    }
  };

  const handleGenerate = async (
    withFeedback?: string,
    useModelSelector?: boolean
  ) => {
    setGenError("");

    const payload: Record<string, string> = {};
    if (useModelSelector) {
      if (modelValue.tier) payload.tier = modelValue.tier;
      if (modelValue.provider) payload.provider = modelValue.provider;
      if (modelValue.model) payload.model = modelValue.model;
    }
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

      if (res.status === 429) {
        setCreditsRemaining(0);
        toast.error("No credits left -- resets tomorrow");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        toast.error("Regeneration failed. Try again later.");
        setGenError(data.error || "Generation request failed");
        return;
      }

      // Show skeleton only after 202 accepted
      setGenerating(true);

      const rateLimitHeader = res.headers.get("X-RateLimit-Remaining");
      if (rateLimitHeader != null) {
        setCreditsRemaining(Number(rateLimitHeader));
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
            setCreditsRemaining((prev) => Math.max(0, prev - 1));
            setUndoAvailable(true);
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            undoTimerRef.current = setTimeout(
              () => setUndoAvailable(false),
              30000
            );
            setGenerating(false);
          } else if (jobData.job?.status === "failed") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            toast.error("Regeneration failed. Try again later.");
            setGenError(jobData.job.error || "Generation failed");
            setGenerating(false);
          }
        } catch {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          toast.error("Failed to check generation status");
          setGenerating(false);
        }
      }, 2000);
    } catch {
      toast.error("Failed to start generation");
    }
  };

  const handleUndo = async () => {
    try {
      const res = await fetch(
        `/api/courses/ai/${id}/lessons/${lessonId}/revert`,
        {
          method: "POST",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        }
      );
      if (res.ok) {
        await fetchLesson();
        setUndoAvailable(false);
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
        toast.success("Lesson reverted");
      } else {
        toast.error(
          "Failed to revert. The previous version may no longer be available."
        );
      }
    } catch {
      toast.error(
        "Failed to revert. The previous version may no longer be available."
      );
    }
  };

  const handleSelectVideo = async (video: {
    videoId: string;
    title: string;
    channelName: string;
    channelId: string;
    thumbnailUrl: string;
    duration: string;
  }) => {
    setSwapping(true);
    try {
      await patchLesson({
        contentType: "video",
        videoUrl: `https://www.youtube.com/embed/${video.videoId}`,
        content: video.title,
        youtubeMetadata: {
          videoId: video.videoId,
          channelName: video.channelName,
          channelId: video.channelId,
          thumbnailUrl: video.thumbnailUrl,
          videoDuration: video.duration,
        },
      });
      setShowVideoPicker(false);
    } catch {
      /* ignore */
    } finally {
      setSwapping(false);
    }
  };

  const handleConvertToText = async () => {
    setSwapping(true);
    try {
      await patchLesson({
        contentType: "text",
        videoUrl: null,
        content: "",
        youtubeMetadata: null,
      });
    } catch {
      /* ignore */
    } finally {
      setSwapping(false);
    }
  };

  const currentModule = modules.find((m) => m._id === moduleId);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="hidden lg:block w-64 shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
          <div className="flex-1 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-24" />
            </div>
            <SkeletonText lines={8} />
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) return null;

  const canGenerate = isOwnedCourse && permissions?.canEdit;
  const canFeedback =
    isOwnedCourse &&
    (permissions?.canEdit || permissions?.isSharedWith);
  const isSkeleton =
    lesson.generationStatus === "skeleton" || (!lesson.content && isOwnedCourse);
  const isCompleted = lesson.generationStatus === "completed";
  const isFailed = lesson.generationStatus === "failed";
  const isAITextLesson = lesson.contentType === "text" && isOwnedCourse;

  const renderModuleLessonList = () => {
    if (!currentModule) return null;
    return (
      <ul className="space-y-1">
        {currentModule.lessons.map((l) => (
          <li key={l._id}>
            <Link
              href={`/courses/${id}/modules/${moduleId}/lessons/${l._id}`}
              className={`block px-3 py-2 text-sm rounded-md truncate min-h-[44px] flex items-center ${
                l._id === lessonId
                  ? "bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 font-medium"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {l.title}
            </Link>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href={`/courses/${id}/overview`}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to course
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Module sidebar - mobile collapsed */}
        {currentModule && (
          <div className="lg:hidden">
            <button
              onClick={() => setModuleNavOpen(!moduleNavOpen)}
              className="w-full flex items-center justify-between min-h-[44px] px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-900 dark:text-white"
            >
              <span className="truncate">{currentModule.title}</span>
              <ChevronDown
                className={`w-4 h-4 shrink-0 ml-2 text-zinc-500 transition-transform ${
                  moduleNavOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {moduleNavOpen && (
              <div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                {renderModuleLessonList()}
              </div>
            )}
          </div>
        )}

        {/* Module sidebar - desktop */}
        {currentModule && (
          <div className="hidden lg:block w-64 shrink-0">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 sticky top-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                {currentModule.title}
              </h3>
              {renderModuleLessonList()}
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
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

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={handleSave}>
                    Save Changes
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {lesson.title}
                      </h1>
                      {!lesson.isPublished && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                      {lesson.contentType} content
                    </p>
                  </div>
                  {permissions?.canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={handlePublish}>
                        {lesson.isPublished ? "Unpublish" : "Publish"}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={handleDelete}>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>

                {/* Generating skeleton */}
                {generating && <ContentGenerationSkeleton />}

                {/* Generation error */}
                {genError && (
                  <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-700 dark:text-red-300">
                        {genError}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setGenError("");
                          handleGenerate();
                        }}
                        className="ml-4 text-red-700 dark:text-red-300"
                      >
                        Try Again
                      </Button>
                    </div>
                  </div>
                )}

                {/* Skeleton state: no content generated yet */}
                {canGenerate && isSkeleton && !generating && (
                  <div className="space-y-4">
                    {lesson.lessonOutline && (
                      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
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
                      <Button
                        onClick={() => handleGenerate(undefined, true)}
                        disabled={generating}
                        className="bg-violet-600 hover:bg-violet-500"
                      >
                        Generate Content
                      </Button>
                    </div>
                  </div>
                )}

                {/* Content display (for completed or content-having lessons) */}
                {!isSkeleton && !generating && (
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
                          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
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
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                        >
                          Download File
                        </a>
                      </div>
                    )}

                    {/* Content */}
                    {lesson.content && (
                      <MarkdownContent
                        content={lesson.content}
                        className={generating ? "opacity-50" : ""}
                      />
                    )}

                    {/* Key Takeaways */}
                    {lesson.keyTakeaways && lesson.keyTakeaways.length > 0 && (
                      <div className="mt-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-2">
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

                    {/* Undo bar after regeneration */}
                    {undoAvailable && (
                      <div className="mt-4 flex items-center justify-between rounded-lg bg-zinc-800 dark:bg-zinc-700 text-white px-4 py-3">
                        <span className="text-sm font-medium">
                          Lesson updated
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleUndo}
                          className="text-white hover:bg-zinc-600 dark:hover:bg-zinc-500"
                        >
                          Undo
                        </Button>
                      </div>
                    )}

                    {/* Inline feedback section for completed/failed AI text lessons */}
                    {canFeedback &&
                      isAITextLesson &&
                      (isCompleted || isFailed) &&
                      !generating && (
                        <FeedbackSection
                          onSubmit={(fb) => handleGenerate(fb)}
                          creditsRemaining={creditsRemaining}
                          disabled={generating}
                          generating={generating}
                        />
                      )}
                  </>
                )}

                {/* Lesson type swap actions */}
                {permissions?.canEdit && isOwnedCourse && !generating && !showVideoPicker && (
                  <div className="mt-6 flex flex-col sm:flex-row gap-2">
                    {lesson.contentType === "text" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowVideoPicker(true)}
                        disabled={swapping}
                        className="text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Replace with YouTube video
                      </Button>
                    )}
                    {lesson.contentType === "video" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleConvertToText}
                        disabled={swapping}
                        className="text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                      >
                        {swapping ? "Converting..." : "Replace with AI text"}
                      </Button>
                    )}
                  </div>
                )}

                {/* YouTube video picker */}
                {showVideoPicker && (
                  <div className="mt-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                    <YouTubeVideoPicker
                      defaultQuery={lesson.title}
                      onSelect={handleSelectVideo}
                      onCancel={() => setShowVideoPicker(false)}
                    />
                  </div>
                )}

                {/* AI Tutor Link */}
                {lesson.content && (
                  <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <Link
                      href={`/courses/${id}/ai/tutor?lessonId=${lessonId}`}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 min-h-[44px]"
                    >
                      Ask AI Tutor about this lesson
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
