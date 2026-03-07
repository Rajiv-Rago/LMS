"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import Button from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

export default function NewCoursePage() {
  const router = useRouter();
  const toast = useToast();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user?.role === "admin") {
            setAuthorized(true);
          } else {
            router.push("/dashboard");
            return;
          }
        } else {
          router.push("/login");
          return;
        }
      } catch {
        router.push("/dashboard");
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAdmin();
  }, [router]);

  if (checkingAuth || !authorized) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" />
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create course");
      }

      toast.success("Course created successfully");
      router.push(`/courses/${data.course._id}/overview`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/courses"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to courses
        </Link>
      </div>

      {/* AI Promotion Banner */}
      <div className="bg-gradient-to-r from-violet-600/10 to-indigo-600/10 dark:from-violet-600/20 dark:to-indigo-600/20 rounded-lg border border-violet-200 dark:border-violet-800 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600">
              <svg
                className="w-4 h-4 text-white"
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
            <p className="text-sm text-violet-700 dark:text-violet-300">
              Want AI to design your course? Just describe what you want to teach.
            </p>
          </div>
          <Link
            href="/courses/new/ai"
            className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg hover:from-violet-500 hover:to-indigo-500 min-h-[44px] flex items-center justify-center"
          >
            Try AI Create
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
          Create New Course
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Course Title
            </label>
            <input
              id="title"
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Introduction to Web Development"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Description
            </label>
            <textarea
              id="description"
              required
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Describe what students will learn in this course..."
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <Link
              href="/courses"
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-center min-h-[44px] flex items-center justify-center"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? "Creating..." : "Create Course"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
