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
  instructor: { name: string; email: string };
  enrolledStudents: string[];
  isPublished: boolean;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Welcome back, {user?.name}!
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Here&apos;s what&apos;s happening with your courses
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {user?.role === "teacher" ? "Your Courses" : "Enrolled Courses"}
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
            {courses.length}
          </p>
        </div>

        {user?.role === "teacher" && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Total Students
            </p>
            <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
              {courses.reduce((acc, c) => acc + c.enrolledStudents.length, 0)}
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Account Type
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white capitalize">
            {user?.role}
          </p>
        </div>
      </div>

      {/* Recent Courses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {user?.role === "teacher" ? "Your Courses" : "Your Enrolled Courses"}
          </h2>
          {user?.role === "teacher" && (
            <div className="flex gap-2">
              <Link
                href="/courses/new"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
              >
                Create Course
              </Link>
              <Link
                href="/courses/new/ai"
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-md hover:from-purple-500 hover:to-blue-500"
              >
                Create with AI
              </Link>
            </div>
          )}
          {user?.role === "student" && (
            <div className="flex gap-2">
              <Link
                href="/courses/new/ai"
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-md hover:from-purple-500 hover:to-blue-500"
              >
                Create AI Course
              </Link>
              <Link
                href="/courses"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Browse Courses
              </Link>
            </div>
          )}
        </div>

        {courses.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              {user?.role === "teacher"
                ? "You haven't created any courses yet."
                : "You haven't enrolled in any courses yet."}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              {user?.role === "teacher" ? (
                <>
                  <Link
                    href="/courses/new"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
                  >
                    Create your first course
                  </Link>
                  <Link
                    href="/courses/new/ai"
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-md hover:from-purple-500 hover:to-blue-500"
                  >
                    Or try AI-powered creation
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/courses/new/ai"
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-md hover:from-purple-500 hover:to-blue-500"
                  >
                    Create a personalized AI course
                  </Link>
                  <Link
                    href="/courses"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
                  >
                    Browse available courses
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 6).map((course) => (
              <Link
                key={course._id}
                href={`/courses/${course._id}`}
                className="block bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
              >
                <h3 className="font-semibold text-zinc-900 dark:text-white truncate">
                  {course.title}
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  {course.description}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>
                    {user?.role === "teacher"
                      ? `${course.enrolledStudents.length} students`
                      : `By ${course.instructor.name}`}
                  </span>
                  {!course.isPublished && user?.role === "teacher" && (
                    <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                      Draft
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
