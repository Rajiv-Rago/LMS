"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface CourseModule {
  lessons: unknown[];
}

interface Course {
  _id: string;
  title: string;
  description?: string;
  modules?: CourseModule[];
  instructor?: { name: string };
}

interface CourseSectionProps {
  title: string;
  courses: Course[];
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  onDelete?: (courseId: string, courseTitle: string) => void;
}

export default function CourseSection({
  title,
  courses,
  emptyMessage = "No courses yet",
  emptyState,
  onDelete,
}: CourseSectionProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const totalLessons = (course: Course) =>
    course.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0) || 0;

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
        {title}
      </h2>

      {courses.length === 0 ? (
        emptyState || (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">
            {emptyMessage}
          </p>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const lessons = totalLessons(course);

            return (
              <div
                key={course._id}
                onClick={() => router.push(`/courses/${course._id}/overview`)}
                className="relative cursor-pointer block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-zinc-900 dark:text-white truncate">
                    {course.title}
                  </h3>
                  {onDelete && (
                    <div
                      ref={menuOpen === course._id ? menuRef : null}
                      className="relative shrink-0"
                    >
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
                              setMenuOpen(null);
                              onDelete(course._id, course.title);
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
                {course.description && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {course.description}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{lessons} lessons</span>
                  {course.instructor && <span>By {course.instructor.name}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
