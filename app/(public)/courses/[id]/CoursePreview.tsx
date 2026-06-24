"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/hooks/useToast";
import ShareDialog from "@/components/course/ShareDialog";
import Button from "@/components/ui/Button";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

interface Lesson {
  _id: string;
  title: string;
  contentType: string;
  order: number;
}

interface Module {
  _id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  _id: string;
  title: string;
  description: string;
  instructor: { _id: string; name: string };
  enrolledCount: number;
  accessLevel: string;
  owner?: string;
  syllabusStatus?: string;
  aiPreferences?: { defaultProvider: string };
  youtubeMetadata?: { skillLevel: string };
  modules: Array<{ _id: string; title: string; lessons: unknown[] }>;
}

interface Permissions {
  canEdit: boolean;
  canEnroll: boolean;
  isEnrolled: boolean;
  isInstructor: boolean;
}

function DocumentIcon() {
  return (
    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-zinc-400 transition-transform ${expanded ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function getLessonIcon(contentType: string) {
  if (contentType === "video") return <VideoIcon />;
  return <DocumentIcon />;
}

function SkeletonPreview() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-32" />
      <SkeletonText lines={3} />
      <Skeleton className="h-12 w-40" />
      <Skeleton className="h-6 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function CoursePreview({ courseId }: { courseId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [lockedLesson, setLockedLesson] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    async function loadCourse() {
      try {
        const [courseRes, modulesRes] = await Promise.all([
          fetch(`/api/courses/${courseId}`, { cache: "no-store" }),
          fetch(`/api/courses/${courseId}/modules`, { cache: "no-store" }),
        ]);

        if (!courseRes.ok) {
          setError(true);
          return;
        }

        const courseData = await courseRes.json();
        setCourse(courseData.course);
        setPermissions(courseData.permissions);

        if (modulesRes.ok) {
          const modulesData = await modulesRes.json();
          setModules(modulesData.modules || []);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    loadCourse();
  }, [courseId]);

  function toggleModule(moduleId: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  function handleLessonClick(moduleId: string, lessonId: string) {
    if (permissions?.isEnrolled || permissions?.canEdit) {
      router.push(`/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`);
    } else {
      setLockedLesson(lessonId);
      setTimeout(() => setLockedLesson(null), 3000);
    }
  }

  async function handleEnroll() {
    setEnrolling(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`, {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      if (res.status === 401) {
        router.push(`/login?enroll=${courseId}`);
        return;
      }

      if (res.ok) {
        toast.success("Enrolled successfully!");
        router.refresh();
        window.location.reload();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to enroll");
      }
    } catch {
      toast.error("Failed to enroll");
    } finally {
      setEnrolling(false);
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success("Link copied!");
    });
  }

  if (loading) return <SkeletonPreview />;

  if (error || !course) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Course not found</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This course may be private or no longer available.
        </p>
        <Link
          href="/explore"
          className="mt-6 inline-block rounded-lg font-medium px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950"
        >
          Back to Explore
        </Link>
      </div>
    );
  }

  const isAICourse = !!(course.aiPreferences || course.syllabusStatus);
  const creatorLabel = isAICourse
    ? `Created by ${course.instructor.name} with AI`
    : `Created by ${course.instructor.name}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="lg:flex lg:gap-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {course.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {creatorLabel}
            </span>
            {course.youtubeMetadata?.skillLevel && (
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                {course.youtubeMetadata.skillLevel}
              </span>
            )}
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {course.enrolledCount} learners enrolled
            </span>
          </div>

          <p className="mt-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {course.description}
          </p>

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Course syllabus
            </h2>

            {modules.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No modules available yet.
              </p>
            ) : (
              <div className="space-y-2">
                {modules
                  .sort((a, b) => a.order - b.order)
                  .map((mod) => (
                    <div
                      key={mod._id}
                      className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleModule(mod._id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <ChevronIcon expanded={expandedModules.has(mod._id)} />
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">
                          {mod.title}
                        </span>
                        <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                          {mod.lessons.length} lessons
                        </span>
                      </button>

                      {expandedModules.has(mod._id) && (
                        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                          {mod.lessons
                            .sort((a, b) => a.order - b.order)
                            .map((lesson) => (
                              <div key={lesson._id} className="relative">
                                <button
                                  onClick={() => handleLessonClick(mod._id, lesson._id)}
                                  className="w-full flex items-center gap-3 px-6 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                                >
                                  {getLessonIcon(lesson.contentType)}
                                  <span>{lesson.title}</span>
                                </button>
                                {lockedLesson === lesson._id && (
                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-amber-600 dark:text-amber-400 animate-in fade-in">
                                    Enroll to access this lesson
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:w-72 mt-8 lg:mt-0">
          <div className="lg:sticky lg:top-24 space-y-3">
            {permissions?.canEdit ? (
              <>
                <Link
                  href={`/courses/${courseId}/modules`}
                  className="block w-full text-center rounded-lg font-medium px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500"
                >
                  Edit Course
                </Link>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setShareOpen(true)}
                >
                  Share
                </Button>
              </>
            ) : permissions?.isEnrolled ? (
              <Link
                href={`/courses/${courseId}/modules`}
                className="block w-full text-center rounded-lg font-medium px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500"
              >
                Continue Learning
              </Link>
            ) : (
              <Button
                variant="primary"
                className="w-full sm:w-auto lg:w-full py-3"
                onClick={handleEnroll}
                disabled={enrolling}
              >
                {enrolling ? "Enrolling..." : "Enroll for Free"}
              </Button>
            )}

            <Button
              variant="secondary"
              className="w-full"
              onClick={handleCopyLink}
            >
              Copy link
            </Button>
          </div>
        </div>
      </div>

      {!permissions?.canEdit && !permissions?.isEnrolled && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 z-40">
          <Button
            variant="primary"
            className="w-full py-3"
            onClick={handleEnroll}
            disabled={enrolling}
          >
            {enrolling ? "Enrolling..." : "Enroll for Free"}
          </Button>
        </div>
      )}

      {permissions?.canEdit && (
        <ShareDialog
          courseId={courseId}
          courseTitle={course.title}
          currentAccessLevel={course.accessLevel as "restricted" | "unlisted" | "published"}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          onAccessLevelChange={(level) => setCourse((prev) => prev ? { ...prev, accessLevel: level } : prev)}
        />
      )}
    </div>
  );
}
