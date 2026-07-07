"use client";

import { useEffect, useState, useRef, useCallback, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import MarkdownContent, { slugify } from "@/components/ui/MarkdownContent";
import YouTubeVideoPicker from "@/components/lesson/YouTubeVideoPicker";
import ContentGenerationSkeleton from "@/components/lesson/ContentGenerationSkeleton";
import FeedbackSection from "@/components/lesson/FeedbackSection";
import Button from "@/components/ui/Button";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { useToast } from "@/lib/hooks/useToast";
import { useBreadcrumbs } from "@/components/nav/breadcrumbs";

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
  sources?: { title: string; url: string }[];
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
  const [moduleNavHidden, setModuleNavHidden] = useState(false);
  const [moduleNavWidth, setModuleNavWidth] = useState(208);
  const [activeHeading, setActiveHeading] = useState("");
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
  const [streamedContent, setStreamedContent] = useState("");
  const [genError, setGenError] = useState("");
  const [genErrorTransient, setGenErrorTransient] = useState(true);
  const [genCorrelationId, setGenCorrelationId] = useState("");
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoGenTriedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const toast = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
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

  const handleGenerate = async (withFeedback?: string) => {
    setGenError("");
    setGenErrorTransient(true);
    setGenCorrelationId("");
    setStreamedContent("");

    const payload: Record<string, string> = {};
    if (withFeedback) payload.feedback = withFeedback;

    if (generating) return;
    setGenerating(true);

    const abort = new AbortController();
    abortRef.current = abort;

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
          signal: abort.signal,
        }
      );

      if (res.status === 429) {
        setCreditsRemaining(0);
        toast.error("No credits left -- resets tomorrow");
        setGenerating(false);
        return;
      }

      if (res.status === 409) {
        toast.info("This lesson is already being generated");
        setGenerating(false);
        return;
      }

      const rateLimitHeader = res.headers.get("X-RateLimit-Remaining");
      if (rateLimitHeader != null) {
        setCreditsRemaining(Number(rateLimitHeader));
      }

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        toast.error("Generation failed. Try again later.");
        setGenError(data.error || "Generation request failed");
        setGenErrorTransient(res.status >= 500 && res.status !== 503);
        if (data.correlationId) setGenCorrelationId(data.correlationId);
        setGenerating(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedTerminalEvent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));

              if (eventType === "chunk") {
                setStreamedContent((prev) => prev + data.text);
              } else if (eventType === "done") {
                receivedTerminalEvent = true;
                await fetchLesson();
                setCreditsRemaining((prev) => Math.max(0, prev - 1));
                setUndoAvailable(true);
                if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                undoTimerRef.current = setTimeout(() => setUndoAvailable(false), 30000);
                setGenerating(false);
                setStreamedContent("");
              } else if (eventType === "error") {
                receivedTerminalEvent = true;
                const msg = data.message || "Generation failed";
                toast.error(msg);
                setGenError(msg);
                setGenErrorTransient(data.isTransient !== false);
                if (data.correlationId) setGenCorrelationId(data.correlationId);
                setGenerating(false);
                setStreamedContent("");
              }
            } catch {
              // ignore malformed JSON
            }
            eventType = "";
          }
        }
      }

      if (!receivedTerminalEvent && !abort.signal.aborted) {
        await fetchLesson();
        setGenerating(false);
        setStreamedContent("");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error("Failed to start generation");
      setGenerating(false);
      setStreamedContent("");
    }
  };

  // Reset auto-gen flag when navigating to a different lesson
  useEffect(() => {
    autoGenTriedRef.current = false;
  }, [lessonId]);

  // Auto-trigger generation for skeleton AI lessons on first load
  useEffect(() => {
    if (loading || !lesson) return;
    if (autoGenTriedRef.current) return;
    if (generating || genError) return;

    const canGenerateNow = isOwnedCourse && permissions?.canEdit;
    const isAITextLesson = lesson.contentType === "text" && isOwnedCourse;
    const needsGeneration =
      isAITextLesson &&
      canGenerateNow &&
      lesson.generationStatus !== "generating" &&
      lesson.generationStatus !== "completed" &&
      !lesson.content;

    if (needsGeneration) {
      autoGenTriedRef.current = true;
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, lesson, permissions, isOwnedCourse, generating, genError]);

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

  // Prev/next across the whole course, in module order
  const flatLessons = modules.flatMap((m) =>
    m.lessons.map((l) => ({ ...l, moduleId: m._id }))
  );
  const lessonIndex = flatLessons.findIndex((l) => l._id === lessonId);
  const prevLesson = lessonIndex > 0 ? flatLessons[lessonIndex - 1] : null;
  const nextLesson =
    lessonIndex >= 0 && lessonIndex < flatLessons.length - 1
      ? flatLessons[lessonIndex + 1]
      : null;

  useBreadcrumbs(
    currentModule && lesson
      ? [
          { label: currentModule.title, href: `/courses/${id}/overview` },
          { label: lesson.title },
        ]
      : []
  );

  // "On this page" TOC: parse h2/h3 from the raw markdown; ids match the
  // slugified headings MarkdownContent renders.
  const tocItems = useMemo(() => {
    const items: { id: string; text: string; level: number }[] = [];
    let inCodeBlock = false;
    for (const line of (lesson?.content || "").split("\n")) {
      if (/^\s*```/.test(line)) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;
      const match = /^(#{2,3})\s+(.+)/.exec(line);
      if (!match) continue;
      const text = match[2]
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_`~]/g, "")
        .trim();
      items.push({ id: slugify(text), text, level: match[1].length });
    }
    return items;
  }, [lesson?.content]);

  // Scrollspy: highlight the TOC entry whose heading is near the viewport top
  useEffect(() => {
    if (!tocItems.length || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "0% 0% -80% 0%" }
    );
    for (const item of tocItems) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [tocItems]);

  const startModuleNavResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const left = (
      e.currentTarget.parentElement as HTMLElement
    ).getBoundingClientRect().left;
    const move = (ev: PointerEvent) =>
      setModuleNavWidth(Math.min(360, Math.max(160, ev.clientX - left)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="hidden xl:block w-52 shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
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
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <Link
          href={`/courses/${id}/overview`}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to course
        </Link>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Module sidebar - collapsed dropdown (mobile & narrow desktop) */}
        {currentModule && (
          <div className="xl:hidden">
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
        {currentModule && !moduleNavHidden && (
          <div
            className="hidden xl:block shrink-0 relative"
            style={{ width: moduleNavWidth }}
          >
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 sticky top-16">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                  {currentModule.title}
                </h3>
                <button
                  onClick={() => setModuleNavHidden(true)}
                  className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  aria-label="Hide lesson list"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
              {renderModuleLessonList()}
            </div>
            {/* Resize handle */}
            <div
              onPointerDown={startModuleNavResize}
              className="absolute inset-y-0 -right-2 w-2 cursor-col-resize hover:bg-indigo-400/40"
              aria-hidden="true"
            />
          </div>
        )}

        {/* Reopen button when lesson list is hidden on desktop */}
        {currentModule && moduleNavHidden && (
          <div className="hidden xl:block shrink-0">
            <button
              onClick={() => setModuleNavHidden(false)}
              className="sticky top-16 flex items-center justify-center h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              aria-label="Show lesson list"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
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
                    <div className="flex flex-wrap gap-2 shrink-0">
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

                {/* Streaming content or skeleton */}
                {generating && (
                  streamedContent
                    ? <MarkdownContent content={streamedContent.replace(/^#[^\n]*\n+/, "")} />
                    : <ContentGenerationSkeleton />
                )}

                {/* Generation error */}
                {genError && (
                  <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-red-700 dark:text-red-300">
                          {genError}
                        </span>
                        {genCorrelationId && (
                          <p className="text-xs text-red-400 dark:text-red-500 mt-1 font-mono">
                            Reference: {genCorrelationId}
                          </p>
                        )}
                      </div>
                      {genErrorTransient && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setGenError("");
                            handleGenerate();
                          }}
                          className="ml-4 text-red-700 dark:text-red-300"
                        >
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Skeleton state: outline placeholder while auto-generation kicks off */}
                {canGenerate && isSkeleton && !generating && lesson.lessonOutline && (
                  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
                      Lesson Outline
                    </h3>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                      {lesson.lessonOutline}
                    </p>
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
                        content={lesson.content.replace(/^#[^\n]*\n+/, "")}
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

                    {/* Sources & Further Reading */}
                    {lesson.sources && lesson.sources.length > 0 && (
                      <div className="mt-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                          Sources &amp; Further Reading
                        </h3>
                        <ul className="space-y-1">
                          {lesson.sources.map((source, i) => (
                            <li key={i} className="text-sm">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                {source.title}
                              </a>
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

          {/* Prev/next lesson navigation */}
          {!editing && (prevLesson || nextLesson) && (
            <div className="mt-4 flex justify-between gap-4">
              {prevLesson ? (
                <Link
                  href={`/courses/${id}/modules/${prevLesson.moduleId}/lessons/${prevLesson._id}`}
                  className="group max-w-[48%] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-indigo-300 dark:hover:border-indigo-700"
                >
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    &larr; Previous
                  </span>
                  <span className="block text-sm font-medium text-zinc-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    {prevLesson.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {nextLesson && (
                <Link
                  href={`/courses/${id}/modules/${nextLesson.moduleId}/lessons/${nextLesson._id}`}
                  className="group max-w-[48%] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-right hover:border-indigo-300 dark:hover:border-indigo-700"
                >
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    Next &rarr;
                  </span>
                  <span className="block text-sm font-medium text-zinc-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    {nextLesson.title}
                  </span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* "On this page" TOC - wide screens only */}
        {!editing && !generating && lesson.content && tocItems.length > 1 && (
          <nav
            aria-label="On this page"
            className="hidden 2xl:block w-56 shrink-0"
          >
            <div className="sticky top-16">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                On this page
              </h3>
              <ul className="border-l border-zinc-200 dark:border-zinc-800">
                {tocItems.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={`block py-1 text-sm border-l-2 -ml-px ${
                        item.level === 3 ? "pl-6" : "pl-3"
                      } ${
                        activeHeading === item.id
                          ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-medium"
                          : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                      }`}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
