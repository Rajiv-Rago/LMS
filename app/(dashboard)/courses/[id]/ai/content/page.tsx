"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ModelSelector, ModelSelectorValue } from "@/components/ai/ModelSelector";
import { useUserAIDefaults } from "@/lib/hooks/useUserAIDefaults";
import { useJobPoller, JobResult } from "@/lib/hooks/useJobPoller";
import { useToast } from "@/lib/hooks/useToast";

interface LessonData {
  _id: string;
  title: string;
  contentType: string;
  order: number;
  content?: string;
  keyTakeaways?: string[];
  generationStatus?: string;
  lessonOutline?: string;
}

interface ModuleData {
  _id: string;
  title: string;
  description?: string;
  order: number;
  contentStatus?: string;
  lessons: LessonData[];
}

interface CourseData {
  _id: string;
  title: string;
  description: string;
  courseType?: string;
  syllabusStatus?: string;
  modules?: ModuleData[];
}

function StatusBadge({ status }: { status?: string }) {
  switch (status) {
    case "generating":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Generating...
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Completed
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          Not Generated
        </span>
      );
  }
}

export default function ContentDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [course, setCourse] = useState<CourseData | null>(null);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [previewLessons, setPreviewLessons] = useState<Set<string>>(new Set());
  const [generatingModules, setGeneratingModules] = useState<Set<string>>(new Set());
  const [generatingLessons, setGeneratingLessons] = useState<Set<string>>(new Set());

  const userDefaults = useUserAIDefaults();
  const [modelValue, setModelValue] = useState<ModelSelectorValue>({
    tier: "balanced",
  });

  useEffect(() => {
    if (!userDefaults.loading) {
      setModelValue(userDefaults.value);
    }
  }, [userDefaults.loading, userDefaults.value]);

  const fetchCourseData = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/ai/${id}/syllabus`);
      if (!res.ok) {
        router.push(`/courses/${id}`);
        return;
      }
      const data = await res.json();
      const c = data.course;

      if (c.courseType !== "ai-generated") {
        router.push(`/courses/${id}`);
        return;
      }

      setCourse(c);
      const mods: ModuleData[] = c.modules || [];
      mods.sort((a: ModuleData, b: ModuleData) => a.order - b.order);
      for (const mod of mods) {
        mod.lessons.sort((a: LessonData, b: LessonData) => a.order - b.order);
      }
      setModules(mods);

      // Auto-expand modules that aren't completed
      const toExpand = new Set<string>();
      for (const mod of mods) {
        if (mod.contentStatus !== "completed") {
          toExpand.add(mod._id);
        }
      }
      setExpandedModules((prev) => {
        const next = new Set(prev);
        for (const id of toExpand) next.add(id);
        return next;
      });

      // Clear generating state for modules/lessons that are no longer generating
      setGeneratingModules((prev) => {
        const next = new Set<string>();
        for (const mid of prev) {
          const mod = mods.find((m: ModuleData) => m._id === mid);
          if (mod && mod.contentStatus === "generating") next.add(mid);
        }
        return next;
      });
      setGeneratingLessons((prev) => {
        const next = new Set<string>();
        for (const lid of prev) {
          for (const mod of mods) {
            const lesson = mod.lessons.find((l: LessonData) => l._id === lid);
            if (lesson && lesson.generationStatus === "generating") next.add(lid);
          }
        }
        return next;
      });
    } catch {
      setError("Failed to load course data");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const handleJobComplete = useCallback(
    (_r: JobResult) => {
      fetchCourseData();
      toast.success("Content generation completed");
    },
    [fetchCourseData, toast]
  );

  const handleJobFailed = useCallback(
    (r: JobResult) => {
      fetchCourseData();
      toast.error(r.error || "Content generation failed");
    },
    [fetchCourseData, toast]
  );

  const { addJobs, activeCount } = useJobPoller({
    onComplete: handleJobComplete,
    onFailed: handleJobFailed,
    interval: 3000,
  });

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  const getModelPayload = () => {
    const payload: Record<string, string> = {};
    if (modelValue.tier) payload.tier = modelValue.tier;
    if (modelValue.provider) payload.provider = modelValue.provider;
    if (modelValue.model) payload.model = modelValue.model;
    return payload;
  };

  const handleGenerateAll = async () => {
    setError("");
    try {
      const res = await fetch(`/api/courses/ai/${id}/generate-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(getModelPayload()),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start generation");
        return;
      }

      if (data.jobs.length === 0) {
        toast.info(data.message || "All modules already generated");
        return;
      }

      // Optimistic update
      const jobModuleIds = new Set<string>(data.jobs.map((j: { moduleId: string }) => j.moduleId));
      setModules((prev) =>
        prev.map((m) =>
          jobModuleIds.has(m._id)
            ? { ...m, contentStatus: "generating" }
            : m
        )
      );
      setGeneratingModules((prev) => {
        const next = new Set(prev);
        for (const mid of jobModuleIds) next.add(mid);
        return next;
      });

      addJobs(
        data.jobs.map((j: { jobId: string; moduleId: string; moduleTitle: string }) => ({
          jobId: j.jobId,
          meta: { moduleId: j.moduleId, moduleTitle: j.moduleTitle },
        }))
      );

      toast.success(`Started generation for ${data.jobs.length} modules`);
    } catch {
      setError("Failed to start generation");
    }
  };

  const handleGenerateModule = async (moduleId: string) => {
    setError("");
    try {
      const res = await fetch(`/api/courses/ai/${id}/modules/${moduleId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(getModelPayload()),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start generation");
        return;
      }

      // Optimistic update
      setModules((prev) =>
        prev.map((m) =>
          m._id === moduleId ? { ...m, contentStatus: "generating" } : m
        )
      );
      setGeneratingModules((prev) => new Set(prev).add(moduleId));

      addJobs([{
        jobId: data.jobId,
        meta: { moduleId },
      }]);
    } catch {
      setError("Failed to start generation");
    }
  };

  const handleRegenerateLesson = async (lessonId: string) => {
    setError("");
    try {
      const res = await fetch(`/api/courses/ai/${id}/lessons/${lessonId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(getModelPayload()),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start generation");
        return;
      }

      // Optimistic update
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) =>
            l._id === lessonId ? { ...l, generationStatus: "generating" } : l
          ),
        }))
      );
      setGeneratingLessons((prev) => new Set(prev).add(lessonId));

      addJobs([{
        jobId: data.jobId,
        meta: { lessonId },
      }]);
    } catch {
      setError("Failed to start generation");
    }
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const togglePreview = (lessonId: string) => {
    setPreviewLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  };

  const completedModules = modules.filter((m) => m.contentStatus === "completed").length;
  const totalModules = modules.length;
  const progressPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  const allModulesCompletedOrGenerating = modules.every(
    (m) => m.contentStatus === "completed" || m.contentStatus === "generating"
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-700 rounded" />
          <div className="h-32 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
          <div className="h-24 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
          <div className="h-24 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!course) return null;

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

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/20">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{course.title}</h1>
              <p className="text-sm text-white/80">
                {completedModules} / {totalModules} modules completed
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-white/20 rounded-full h-2">
              <div
                className="bg-white h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <ModelSelector
                value={modelValue}
                onChange={setModelValue}
                disabled={activeCount > 0}
              />
            </div>
            <button
              onClick={handleGenerateAll}
              disabled={allModulesCompletedOrGenerating || activeCount > 0}
              className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-md hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {activeCount > 0
                ? `Generating... (${activeCount} active)`
                : "Generate All Content"}
            </button>
          </div>
        </div>
      </div>

      {/* Module Cards */}
      <div className="space-y-4">
        {modules.map((mod) => {
          const isExpanded = expandedModules.has(mod._id);
          const moduleStatus = generatingModules.has(mod._id) ? "generating" : mod.contentStatus;
          const canGenerate = moduleStatus === "skeleton" || moduleStatus === "failed";

          return (
            <div
              key={mod._id}
              className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              {/* Module Header */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleModule(mod._id)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 shrink-0"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                    <h3 className="font-medium text-zinc-900 dark:text-white truncate">
                      {mod.title}
                    </h3>
                    <StatusBadge status={moduleStatus} />
                  </div>
                  {canGenerate && (
                    <button
                      onClick={() => handleGenerateModule(mod._id)}
                      disabled={activeCount > 0 && !generatingModules.has(mod._id)}
                      className="ml-3 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/70 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      {moduleStatus === "failed" ? "Retry" : "Generate"}
                    </button>
                  )}
                </div>
                {mod.description && (
                  <p className="mt-1 ml-7 text-sm text-zinc-500 dark:text-zinc-400">
                    {mod.description}
                  </p>
                )}
              </div>

              {/* Lessons */}
              {isExpanded && (
                <div>
                  {mod.lessons.length === 0 ? (
                    <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                      No lessons in this module.
                    </p>
                  ) : (
                    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {mod.lessons.map((lesson) => {
                        const lessonStatus = generatingLessons.has(lesson._id)
                          ? "generating"
                          : lesson.generationStatus;
                        const isCompleted = lessonStatus === "completed";
                        const canRegenerate =
                          lessonStatus === "completed" ||
                          lessonStatus === "failed" ||
                          lessonStatus === "skeleton";
                        const isGenerating = lessonStatus === "generating";
                        const showPreview = previewLessons.has(lesson._id);

                        return (
                          <li key={lesson._id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="text-zinc-400 shrink-0">
                                  {lesson.contentType === "video" ? "\u25B6" : "\uD83D\uDCC4"}
                                </span>
                                <span className="text-sm text-zinc-900 dark:text-white truncate">
                                  {lesson.title}
                                </span>
                                <StatusBadge status={lessonStatus} />
                              </div>
                              <div className="flex items-center gap-2 ml-3 shrink-0">
                                {isCompleted && (
                                  <button
                                    onClick={() => togglePreview(lesson._id)}
                                    className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                                  >
                                    {showPreview ? "Hide" : "Preview"}
                                  </button>
                                )}
                                {canRegenerate && !isGenerating && (
                                  <button
                                    onClick={() => handleRegenerateLesson(lesson._id)}
                                    disabled={isGenerating}
                                    className="px-2 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 rounded hover:bg-purple-200 dark:hover:bg-purple-900/70 disabled:opacity-50"
                                  >
                                    {lessonStatus === "completed" ? "Regenerate" : lessonStatus === "failed" ? "Retry" : "Generate"}
                                  </button>
                                )}
                                {isCompleted && (
                                  <Link
                                    href={`/courses/${id}/modules/${mod._id}/lessons/${lesson._id}`}
                                    className="px-2 py-1 text-xs text-blue-600 hover:text-blue-500"
                                  >
                                    View
                                  </Link>
                                )}
                              </div>
                            </div>

                            {/* Content Preview */}
                            {showPreview && isCompleted && (
                              <div className="mt-3 ml-7 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-md text-sm">
                                {lesson.content && (
                                  <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap line-clamp-6">
                                    {lesson.content.slice(0, 300)}
                                    {lesson.content.length > 300 ? "..." : ""}
                                  </p>
                                )}
                                {lesson.keyTakeaways && lesson.keyTakeaways.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                                      Key Takeaways:
                                    </p>
                                    <ul className="list-disc list-inside text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5">
                                      {lesson.keyTakeaways.map((t, i) => (
                                        <li key={i}>{t}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
