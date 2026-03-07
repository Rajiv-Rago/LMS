"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useConfirm } from "@/lib/hooks/useConfirm";
import { useToast } from "@/lib/hooks/useToast";

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "teacher" | "admin";
}

interface Course {
  _id: string;
  title: string;
  description: string;
  instructor: { _id: string; name: string; email: string };
  enrolledStudents: string[];
  isPublished: boolean;
  owner?: string;
}

type Filter = "all" | "teaching" | "learning";

export default function CoursesPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRes, coursesRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/courses"),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }

        if (coursesRes.ok) {
          const coursesData = await coursesRes.json();
          setCourses(coursesData.courses);
        }
      } catch {
        // Handled by error boundary
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isOwner = (course: Course) =>
    user && (course.instructor._id === user.id || course.owner === user.id);

  const filteredCourses = courses
    .filter((course) => {
      if (filter === "teaching") return isOwner(course);
      if (filter === "learning") return !isOwner(course);
      return true;
    })
    .filter(
      (course) =>
        course.title.toLowerCase().includes(search.toLowerCase()) ||
        course.description.toLowerCase().includes(search.toLowerCase())
    );

  const handleDelete = async (courseId: string, courseTitle: string) => {
    setMenuOpen(null);
    const confirmed = await confirm({
      title: "Delete Course",
      message: `Are you sure you want to delete "${courseTitle}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (res.ok) {
        setCourses((prev) => prev.filter((c) => c._id !== courseId));
        toast.success("Course deleted");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete course");
      }
    } catch {
      toast.error("Failed to delete course");
    }
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "teaching", label: "Teaching" },
    { key: "learning", label: "Learning" },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Courses
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Browse and manage your courses
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-md rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filteredCourses.length === 0 ? (
        search || filter !== "all" ? (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No courses found matching your criteria.
            </p>
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No courses"
            description="You haven't created or enrolled in any courses yet"
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => {
            const owned = isOwner(course);
            const isEnrolled =
              user && course.enrolledStudents.includes(user.id);

            return (
              <div
                key={course._id}
                onClick={() => router.push(`/courses/${course._id}/overview`)}
                className="relative cursor-pointer bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-white truncate flex-1">
                      {course.title}
                    </h3>
                    <div className="flex items-center gap-1 ml-2">
                      {!course.isPublished && owned && !course.owner && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                          Draft
                        </span>
                      )}
                      {owned && (
                        <div ref={menuOpen === course._id ? menuRef : null} className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(menuOpen === course._id ? null : course._id);
                            }}
                            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                            aria-label="Course actions"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                          {menuOpen === course._id && (
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 shadow-lg z-50 py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(course._id, course.title);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {course.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span>By {course.instructor.name}</span>
                    <span>{course.enrolledStudents.length} students</span>
                  </div>
                  {isEnrolled && !owned && (
                    <div className="mt-3">
                      <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                        Enrolled
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
