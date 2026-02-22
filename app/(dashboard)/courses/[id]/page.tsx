"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { SkeletonCard } from "@/components/ui/Skeleton";

interface Module {
  _id: string;
  title: string;
  description?: string;
  order: number;
  isPublished: boolean;
  contentStatus?: string;
  lessons: Lesson[];
}

interface Lesson {
  _id: string;
  title: string;
  contentType: string;
  order: number;
  isPublished: boolean;
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

  useEffect(() => {
    async function fetchData() {
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

        if (modulesRes.ok) {
          const modulesData = await modulesRes.json();
          setModules(modulesData.modules);
        }
      } catch {
        // Handled by error boundary
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, router]);

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

  const handlePublish = async () => {
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
                  onClick={handlePublish}
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
            {course.courseType === "ai-generated" && permissions?.isInstructor && (
              <Link
                href={`/courses/${id}/ai/content`}
                className="px-3 py-1.5 text-sm text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/70"
              >
                AI Content
              </Link>
            )}
          </div>
        )}
      </div>

      {/* AI Content Banner */}
      {course.courseType === "ai-generated" && permissions?.isInstructor && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-purple-900 dark:text-purple-200">
              AI Content Generation
            </h3>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              {modules.filter((m) => m.contentStatus === "completed").length} / {modules.length} modules have generated content
            </p>
          </div>
          <Link
            href={`/courses/${id}/ai/content`}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-md hover:from-purple-500 hover:to-blue-500"
          >
            Manage Content
          </Link>
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
            {modules.map((module) => (
              <div
                key={module._id}
                className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"
              >
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-zinc-900 dark:text-white">
                        {module.title}
                      </h3>
                      {!module.isPublished && permissions?.canEdit && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                          Draft
                        </span>
                      )}
                      {module.contentStatus && module.contentStatus !== "completed" && (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            module.contentStatus === "generating"
                              ? "bg-blue-500 animate-pulse"
                              : module.contentStatus === "failed"
                              ? "bg-red-500"
                              : "bg-zinc-400"
                          }`}
                          title={`Content: ${module.contentStatus}`}
                        />
                      )}
                    </div>
                    {permissions?.canEdit && (
                      <Link
                        href={`/courses/${id}/modules/${module._id}`}
                        className="text-sm text-blue-600 hover:text-blue-500"
                      >
                        Edit
                      </Link>
                    )}
                  </div>
                  {module.description && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {module.description}
                    </p>
                  )}
                </div>

                {module.lessons.length > 0 && (
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {module.lessons.map((lesson) => (
                      <li key={lesson._id}>
                        <Link
                          href={`/courses/${id}/modules/${module._id}/lessons/${lesson._id}`}
                          className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-zinc-400">
                              {lesson.contentType === "video" ? "▶" : "📄"}
                            </span>
                            <span className="text-zinc-900 dark:text-white">
                              {lesson.title}
                            </span>
                            {!lesson.isPublished && permissions?.canEdit && (
                              <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                                Draft
                              </span>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {module.lessons.length === 0 && (
                  <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                    No lessons in this module yet.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
