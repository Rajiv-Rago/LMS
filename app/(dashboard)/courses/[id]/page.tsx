"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ai/StatusBadge";
import { ModelSelector, ModelSelectorValue } from "@/components/ai/ModelSelector";
import { useUserAIDefaults } from "@/lib/hooks/useUserAIDefaults";
import { useJobPoller, JobResult } from "@/lib/hooks/useJobPoller";

interface Lesson {
  _id: string;
  title: string;
  contentType: string;
  order: number;
  isPublished: boolean;
  content?: string;
  keyTakeaways?: string[];
  generationStatus?: string;
  lessonOutline?: string;
}

interface Module {
  _id: string;
  title: string;
  description?: string;
  order: number;
  isPublished: boolean;
  contentStatus?: string;
  lessons: Lesson[];
}

interface Course {
  _id: string;
  title: string;
  description: string;
  instructor: { _id: string; name: string; email: string };
  enrolledStudents: { _id: string; name: string }[];
  isPublished: boolean;
  courseType?: string;
  syllabusStatus?: string;
}

interface Permissions {
  canEdit: boolean;
  canEnroll: boolean;
  isEnrolled: boolean;
  isInstructor: boolean;
}

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [showNewModule, setShowNewModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  // Expandable modules
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Inline module editing
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editModuleData, setEditModuleData] = useState({ title: "", description: "" });

  // Inline add lesson
  const [addingLessonTo, setAddingLessonTo] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");

  // AI generation state
  const isAICourse = course?.courseType === "ai-generated";
  const [generatingModules, setGeneratingModules] = useState<Set<string>>(new Set());
  const [generatingLessons, setGeneratingLessons] = useState<Set<string>>(new Set());
  const [previewLessons, setPreviewLessons] = useState<Set<string>>(new Set());
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [aiError, setAiError] = useState("");

  const userDefaults = useUserAIDefaults();
  const [modelValue, setModelValue] = useState<ModelSelectorValue>({
    tier: "balanced",
  });

  useEffect(() => {
    if (!userDefaults.loading) {
      setModelValue(userDefaults.value);
    }
  }, [userDefaults.loading, userDefaults.value]);

  const fetchAISyllabusData = useCallback(async (mods: Module[]) => {
    try {
      const res = await fetch(`/api/courses/ai/${id}/syllabus`);
      if (!res.ok) return mods;
      const data = await res.json();
      const aiModules = data.course?.modules || [];

      // Merge AI data into modules
      return mods.map((mod) => {
        const aiMod = aiModules.find((am: Module) => am._id === mod._id);
        if (!aiMod) return mod;
        return {
          ...mod,
          contentStatus: aiMod.contentStatus || mod.contentStatus,
          lessons: mod.lessons.map((lesson) => {
            const aiLesson = aiMod.lessons.find((al: Lesson) => al._id === lesson._id);
            if (!aiLesson) return lesson;
            return {
              ...lesson,
              content: aiLesson.content,
              keyTakeaways: aiLesson.keyTakeaways,
              generationStatus: aiLesson.generationStatus,
              lessonOutline: aiLesson.lessonOutline,
            };
          }),
        };
      });
    } catch {
      return mods;
    }
  }, [id]);

  const fetchData = useCallback(async () => {
    try {
      const [courseRes, modulesRes] = await Promise.all([
        fetch(`/api/courses/${id}`),
        fetch(`/api/courses/${id}/modules`),
      ]);

      if (!courseRes.ok) {
        router.push("/courses");
        return;
      }

      const courseData = await courseRes.json();
      setCourse(courseData.course);
      setPermissions(courseData.permissions);

      let mods: Module[] = [];
      if (modulesRes.ok) {
        const modulesData = await modulesRes.json();
        mods = modulesData.data;
      }

      // For AI courses, fetch richer lesson data and merge
      if (courseData.course.courseType === "ai-generated") {
        mods = await fetchAISyllabusData(mods);

        // Clear generating state for modules/lessons that finished
        setGeneratingModules((prev) => {
          const next = new Set<string>();
          for (const mid of prev) {
            const mod = mods.find((m) => m._id === mid);
            if (mod && mod.contentStatus === "generating") next.add(mid);
          }
          return next;
        });
        setGeneratingLessons((prev) => {
          const next = new Set<string>();
          for (const lid of prev) {
            for (const mod of mods) {
              const lesson = mod.lessons.find((l) => l._id === lid);
              if (lesson && lesson.generationStatus === "generating") next.add(lid);
            }
          }
          return next;
        });
      }

      setModules(mods);
    } catch {
      // Handled by error boundary
    } finally {
      setLoading(false);
    }
  }, [id, router, fetchAISyllabusData]);

  // Job poller callbacks
  const handleJobComplete = useCallback(
    (_r: JobResult) => {
      fetchData();
      toast.success("Content generation completed");
    },
    [fetchData, toast]
  );

  const handleJobFailed = useCallback(
    (r: JobResult) => {
      fetchData();
      toast.error(r.error || "Content generation failed");
    },
    [fetchData, toast]
  );

  const { addJobs, activeCount } = useJobPoller({
    onComplete: handleJobComplete,
    onFailed: handleJobFailed,
    interval: 3000,
  });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Course actions ---

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await fetch(`/api/courses/${id}/enroll`, {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      if (res.ok) {
        setPermissions((prev) =>
          prev ? { ...prev, isEnrolled: true, canEnroll: false } : null
        );
        toast.success("Enrolled successfully");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to enroll");
      }
    } catch {
      toast.error("Failed to enroll");
    } finally {
      setEnrolling(false);
    }
  };

  const handlePublishCourse = async () => {
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ isPublished: !course?.isPublished }),
      });

      if (res.ok) {
        const data = await res.json();
        setCourse(data.course);
        toast.success(data.course.isPublished ? "Course published" : "Course unpublished");
      } else {
        toast.error("Failed to update course");
      }
    } catch {
      toast.error("Failed to update course");
    }
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/courses/${id}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ title: newModuleTitle }),
      });

      if (res.ok) {
        const data = await res.json();
        setModules([...modules, { ...data.module, lessons: [] }]);
        setNewModuleTitle("");
        setShowNewModule(false);
        toast.success("Module added");
      } else {
        toast.error("Failed to add module");
      }
    } catch {
      toast.error("Failed to add module");
    }
  };

  // --- Module actions ---

  const toggleExpand = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const startEditModule = (mod: Module) => {
    setEditingModule(mod._id);
    setEditModuleData({ title: mod.title, description: mod.description || "" });
  };

  const handleSaveModule = async (moduleId: string) => {
    try {
      const res = await fetch(`/api/courses/${id}/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(editModuleData),
      });

      if (res.ok) {
        const data = await res.json();
        setModules((prev) =>
          prev.map((m) => (m._id === moduleId ? { ...m, ...data.module } : m))
        );
        setEditingModule(null);
        toast.success("Module updated");
      } else {
        toast.error("Failed to update module");
      }
    } catch {
      toast.error("Failed to update module");
    }
  };

  const handlePublishModule = async (moduleId: string, isPublished: boolean) => {
    try {
      const res = await fetch(`/api/courses/${id}/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ isPublished: !isPublished }),
      });

      if (res.ok) {
        const data = await res.json();
        setModules((prev) =>
          prev.map((m) => (m._id === moduleId ? { ...m, ...data.module } : m))
        );
      }
    } catch {
      toast.error("Failed to update module");
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm("Are you sure you want to delete this module?")) return;

    try {
      const res = await fetch(`/api/courses/${id}/modules/${moduleId}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      if (res.ok) {
        setModules((prev) => prev.filter((m) => m._id !== moduleId));
        toast.success("Module deleted");
      } else {
        toast.error("Failed to delete module");
      }
    } catch {
      toast.error("Failed to delete module");
    }
  };

  // --- Lesson actions ---

  const handleAddLesson = async (e: React.FormEvent, moduleId: string) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/courses/${id}/modules/${moduleId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ title: newLessonTitle }),
      });

      if (res.ok) {
        const data = await res.json();
        setModules((prev) =>
          prev.map((m) =>
            m._id === moduleId
              ? { ...m, lessons: [...m.lessons, data.lesson] }
              : m
          )
        );
        setNewLessonTitle("");
        setAddingLessonTo(null);
        toast.success("Lesson added");
      } else {
        toast.error("Failed to add lesson");
      }
    } catch {
      toast.error("Failed to add lesson");
    }
  };

  // --- AI generation actions ---

  const getModelPayload = () => {
    const payload: Record<string, string> = {};
    if (modelValue.tier) payload.tier = modelValue.tier;
    if (modelValue.provider) payload.provider = modelValue.provider;
    if (modelValue.model) payload.model = modelValue.model;
    return payload;
  };

  const handleGenerateAll = async () => {
    setAiError("");
    try {
      const res = await fetch(`/api/courses/ai/${id}/generate-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(getModelPayload()),
      });

      const data = await res.json();

      if (!res.ok) {
        setAiError(data.error || "Failed to start generation");
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
          jobModuleIds.has(m._id) ? { ...m, contentStatus: "generating" } : m
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
      setAiError("Failed to start generation");
    }
  };

  const handleGenerateModule = async (moduleId: string) => {
    setAiError("");
    try {
      const res = await fetch(`/api/courses/ai/${id}/modules/${moduleId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(getModelPayload()),
      });

      const data = await res.json();

      if (!res.ok) {
        setAiError(data.error || "Failed to start generation");
        return;
      }

      setModules((prev) =>
        prev.map((m) =>
          m._id === moduleId ? { ...m, contentStatus: "generating" } : m
        )
      );
      setGeneratingModules((prev) => new Set(prev).add(moduleId));

      addJobs([{ jobId: data.jobId, meta: { moduleId } }]);
    } catch {
      setAiError("Failed to start generation");
    }
  };

  const handleRegenerateLesson = async (lessonId: string) => {
    setAiError("");
    try {
      const res = await fetch(`/api/courses/ai/${id}/lessons/${lessonId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(getModelPayload()),
      });

      const data = await res.json();

      if (!res.ok) {
        setAiError(data.error || "Failed to start generation");
        return;
      }

      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) =>
            l._id === lessonId ? { ...l, generationStatus: "generating" } : l
          ),
        }))
      );
      setGeneratingLessons((prev) => new Set(prev).add(lessonId));

      addJobs([{ jobId: data.jobId, meta: { lessonId } }]);
    } catch {
      setAiError("Failed to start generation");
    }
  };

  const handleGenerateSelected = async () => {
    // Generate selected modules
    for (const moduleId of selectedModules) {
      const mod = modules.find((m) => m._id === moduleId);
      if (mod && mod.contentStatus !== "completed" && mod.contentStatus !== "generating") {
        await handleGenerateModule(moduleId);
      }
    }
    // Generate selected lessons
    for (const lessonId of selectedLessons) {
      await handleRegenerateLesson(lessonId);
    }
    setSelectedModules(new Set());
    setSelectedLessons(new Set());
  };

  const toggleModuleSelection = (moduleId: string) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const toggleLessonSelection = (lessonId: string) => {
    setSelectedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  const togglePreview = (lessonId: string) => {
    setPreviewLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  // AI stats
  const completedModules = modules.filter((m) => m.contentStatus === "completed").length;
  const totalModules = modules.length;
  const progressPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
  const allModulesCompletedOrGenerating = modules.every(
    (m) => m.contentStatus === "completed" || m.contentStatus === "generating"
  );
  const hasSelection = selectedModules.size > 0 || selectedLessons.size > 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!course) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <Link
          href="/courses"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to courses
        </Link>
      </div>

      {/* Course Header */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {course.title}
              </h1>
              {!course.isPublished && (
                <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                  Draft
                </span>
              )}
            </div>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              {course.description}
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Instructor: {course.instructor.name} &bull;{" "}
              {course.enrolledStudents.length} students enrolled
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {permissions?.canEnroll && (
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:opacity-50"
              >
                {enrolling ? "Enrolling..." : "Enroll Now"}
              </button>
            )}

            {permissions?.isEnrolled && !permissions?.isInstructor && (
              <span className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 dark:bg-green-900/50 dark:text-green-300 rounded-md">
                Enrolled
              </span>
            )}

            {permissions?.canEdit && (
              <>
                <button
                  onClick={handlePublishCourse}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  {course.isPublished ? "Unpublish" : "Publish"}
                </button>
                <Link
                  href={`/courses/${id}/edit`}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  Edit Course
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Quick Links */}
        {(permissions?.isEnrolled || permissions?.isInstructor) && (
          <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2">
            <Link
              href={`/courses/${id}/assignments`}
              className="px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              Assignments
            </Link>
            {permissions?.isInstructor && (
              <Link
                href={`/courses/${id}/gradebook`}
                className="px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                Gradebook
              </Link>
            )}
            {permissions?.isEnrolled && !permissions?.isInstructor && (
              <Link
                href={`/courses/${id}/grades`}
                className="px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                My Grades
              </Link>
            )}
            <Link
              href={`/courses/${id}/ai/tutor`}
              className="px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              AI Tutor
            </Link>
            {permissions?.isInstructor && (
              <Link
                href={`/courses/${id}/ai/generate`}
                className="px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                AI Content Generator
              </Link>
            )}
          </div>
        )}
      </div>

      {/* AI Generation Toolbar */}
      {isAICourse && permissions?.canEdit && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20">
                <svg
                  className="w-5 h-5 text-white"
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
                <p className="text-sm font-medium text-white">
                  AI Content Generation
                </p>
                <p className="text-xs text-white/80">
                  {completedModules} / {totalModules} modules completed
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="w-full bg-white/20 rounded-full h-1.5">
                <div
                  className="bg-white h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {aiError && (
            <div className="px-6 pt-4">
              <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-3">
                <p className="text-sm text-red-700 dark:text-red-200">{aiError}</p>
              </div>
            </div>
          )}

          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1">
                <ModelSelector
                  value={modelValue}
                  onChange={setModelValue}
                  disabled={activeCount > 0}
                />
              </div>
              <div className="flex gap-2 shrink-0">
                {hasSelection && (
                  <button
                    onClick={handleGenerateSelected}
                    disabled={activeCount > 0}
                    className="px-4 py-2.5 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/70 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Generate Selected ({selectedModules.size + selectedLessons.size})
                  </button>
                )}
                <button
                  onClick={handleGenerateAll}
                  disabled={allModulesCompletedOrGenerating || activeCount > 0}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-md hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {activeCount > 0
                    ? `Generating... (${activeCount} active)`
                    : "Generate All"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modules */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Course Content
          </h2>
          {permissions?.canEdit && (
            <button
              onClick={() => setShowNewModule(true)}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              + Add Module
            </button>
          )}
        </div>

        {showNewModule && (
          <form
            onSubmit={handleAddModule}
            className="mb-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4"
          >
            <input
              type="text"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="Module title"
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
              >
                Add Module
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewModule(false);
                  setNewModuleTitle("");
                }}
                className="px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {modules.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              No content available yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {modules.map((mod) => {
              const isExpanded = expandedModules.has(mod._id);
              const isEditing = editingModule === mod._id;
              const moduleStatus = generatingModules.has(mod._id) ? "generating" : mod.contentStatus;
              const canGenerateModule = isAICourse && (moduleStatus === "skeleton" || moduleStatus === "failed");

              return (
                <div
                  key={mod._id}
                  className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                >
                  {/* Module Header */}
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                    {isEditing ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editModuleData.title}
                          onChange={(e) =>
                            setEditModuleData({ ...editModuleData, title: e.target.value })
                          }
                          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                          autoFocus
                        />
                        <textarea
                          rows={2}
                          value={editModuleData.description}
                          onChange={(e) =>
                            setEditModuleData({ ...editModuleData, description: e.target.value })
                          }
                          placeholder="Description (optional)"
                          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveModule(mod._id)}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingModule(null)}
                            className="px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* AI selection checkbox */}
                            {isAICourse && permissions?.canEdit && canGenerateModule && (
                              <input
                                type="checkbox"
                                checked={selectedModules.has(mod._id)}
                                onChange={() => toggleModuleSelection(mod._id)}
                                className="rounded border-zinc-300 dark:border-zinc-600 text-purple-600 focus:ring-purple-500 shrink-0"
                              />
                            )}
                            <button
                              onClick={() => toggleExpand(mod._id)}
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
                            {!mod.isPublished && permissions?.canEdit && (
                              <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                                Draft
                              </span>
                            )}
                            {isAICourse && <StatusBadge status={moduleStatus} />}
                          </div>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            {isAICourse && canGenerateModule && (
                              <button
                                onClick={() => handleGenerateModule(mod._id)}
                                disabled={activeCount > 0 && !generatingModules.has(mod._id)}
                                className="px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/70 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {moduleStatus === "failed" ? "Retry" : "Generate"}
                              </button>
                            )}
                            {permissions?.canEdit && (
                              <>
                                <button
                                  onClick={() => handlePublishModule(mod._id, mod.isPublished)}
                                  className="px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                                >
                                  {mod.isPublished ? "Unpublish" : "Publish"}
                                </button>
                                <button
                                  onClick={() => startEditModule(mod)}
                                  className="px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteModule(mod._id)}
                                  className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-500"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {mod.description && (
                          <p className="mt-1 ml-6 text-sm text-zinc-500 dark:text-zinc-400">
                            {mod.description}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Lessons (expanded) */}
                  {isExpanded && (
                    <div>
                      {mod.lessons.length === 0 ? (
                        <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                          No lessons in this module yet.
                        </p>
                      ) : (
                        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {mod.lessons.map((lesson) => {
                            const lessonStatus = generatingLessons.has(lesson._id)
                              ? "generating"
                              : lesson.generationStatus;
                            const isLessonCompleted = lessonStatus === "completed";
                            const canRegenerateLesson =
                              isAICourse &&
                              (lessonStatus === "completed" ||
                                lessonStatus === "failed" ||
                                lessonStatus === "skeleton");
                            const isLessonGenerating = lessonStatus === "generating";
                            const showPreview = previewLessons.has(lesson._id);

                            return (
                              <li key={lesson._id} className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {/* AI selection checkbox */}
                                    {isAICourse && permissions?.canEdit && canRegenerateLesson && !isLessonGenerating && (
                                      <input
                                        type="checkbox"
                                        checked={selectedLessons.has(lesson._id)}
                                        onChange={() => toggleLessonSelection(lesson._id)}
                                        className="rounded border-zinc-300 dark:border-zinc-600 text-purple-600 focus:ring-purple-500 shrink-0"
                                      />
                                    )}
                                    <span className="text-zinc-400 shrink-0">
                                      {lesson.contentType === "video" ? "\u25B6" : "\uD83D\uDCC4"}
                                    </span>
                                    <Link
                                      href={`/courses/${id}/modules/${mod._id}/lessons/${lesson._id}`}
                                      className="text-sm text-zinc-900 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400"
                                    >
                                      {lesson.title}
                                    </Link>
                                    {!lesson.isPublished && permissions?.canEdit && (
                                      <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                                        Draft
                                      </span>
                                    )}
                                    {isAICourse && <StatusBadge status={lessonStatus} />}
                                  </div>
                                  <div className="flex items-center gap-2 ml-3 shrink-0">
                                    {isAICourse && isLessonCompleted && (
                                      <button
                                        onClick={() => togglePreview(lesson._id)}
                                        className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                                      >
                                        {showPreview ? "Hide" : "Preview"}
                                      </button>
                                    )}
                                    {canRegenerateLesson && !isLessonGenerating && (
                                      <button
                                        onClick={() => handleRegenerateLesson(lesson._id)}
                                        className="px-2 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 rounded hover:bg-purple-200 dark:hover:bg-purple-900/70 disabled:opacity-50"
                                      >
                                        {lessonStatus === "completed" ? "Regenerate" : lessonStatus === "failed" ? "Retry" : "Generate"}
                                      </button>
                                    )}
                                    {!isAICourse && (
                                      <Link
                                        href={`/courses/${id}/modules/${mod._id}/lessons/${lesson._id}`}
                                        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                      >
                                        Edit &rarr;
                                      </Link>
                                    )}
                                    {isAICourse && isLessonCompleted && (
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
                                {showPreview && isLessonCompleted && (
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

                      {/* Add Lesson */}
                      {permissions?.canEdit && (
                        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                          {addingLessonTo === mod._id ? (
                            <form onSubmit={(e) => handleAddLesson(e, mod._id)}>
                              <input
                                type="text"
                                value={newLessonTitle}
                                onChange={(e) => setNewLessonTitle(e.target.value)}
                                placeholder="Lesson title"
                                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                                autoFocus
                              />
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="submit"
                                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
                                >
                                  Add Lesson
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddingLessonTo(null);
                                    setNewLessonTitle("");
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              onClick={() => {
                                setAddingLessonTo(mod._id);
                                setExpandedModules((prev) => new Set(prev).add(mod._id));
                              }}
                              className="text-sm font-medium text-blue-600 hover:text-blue-500"
                            >
                              + Add Lesson
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
