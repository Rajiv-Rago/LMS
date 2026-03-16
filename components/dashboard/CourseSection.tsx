"use client";

import React from "react";
import Link from "next/link";

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
}

export default function CourseSection({
  title,
  courses,
  emptyMessage = "No courses yet",
  emptyState,
}: CourseSectionProps) {
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
              <Link
                key={course._id}
                href={`/courses/${course._id}/overview`}
                className="block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors"
              >
                <h3 className="font-semibold text-zinc-900 dark:text-white truncate">
                  {course.title}
                </h3>
                {course.description && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {course.description}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{lessons} lessons</span>
                  {course.instructor && <span>By {course.instructor.name}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
