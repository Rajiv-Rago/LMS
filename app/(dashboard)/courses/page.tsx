"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
}

export default function CoursesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredCourses = courses.filter(
    (course) =>
      course.title.toLowerCase().includes(search.toLowerCase()) ||
      course.description.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
            {user?.role === "teacher"
              ? "Manage your courses"
              : "Browse and enroll in courses"}
          </p>
        </div>

        {user?.role === "teacher" && (
          <Link
            href="/courses/new"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
          >
            Create Course
          </Link>
        )}
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Course List */}
      {filteredCourses.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            {search
              ? "No courses found matching your search."
              : user?.role === "teacher"
              ? "You haven't created any courses yet."
              : "No courses available."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => {
            const isOwner = user && course.instructor._id === user.id;
            const isEnrolled =
              user && course.enrolledStudents.includes(user.id);

            return (
              <Link
                key={course._id}
                href={`/courses/${course._id}`}
                className="block bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 transition-colors overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-zinc-900 dark:text-white truncate flex-1">
                      {course.title}
                    </h3>
                    {!course.isPublished && isOwner && (
                      <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {course.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span>By {course.instructor.name}</span>
                    <span>{course.enrolledStudents.length} students</span>
                  </div>
                  {isEnrolled && !isOwner && (
                    <div className="mt-3">
                      <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                        Enrolled
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
