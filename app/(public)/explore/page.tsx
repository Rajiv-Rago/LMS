"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface CourseCard {
  _id: string;
  title: string;
  description: string;
  coverImage?: string;
  enrolledCount: number;
  modules: Array<{
    lessons: Array<string | { _id: string }>;
  }>;
  youtubeMetadata?: {
    skillLevel: string;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="aspect-video bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-full" />
        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-1/2" />
        <div className="flex gap-2 pt-2">
          <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse w-20" />
          <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse w-24" />
        </div>
      </div>
    </div>
  );
}

function getLessonCount(modules: CourseCard["modules"]): number {
  return modules.reduce((sum, mod) => sum + (mod.lessons?.length || 0), 0);
}

export default function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const currentPageRef = useRef(1);

  const fetchCourses = useCallback(
    async (page: number, searchTerm: string, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          catalog: "true",
          page: String(page),
          limit: "12",
        });
        if (searchTerm) {
          params.set("search", searchTerm);
        }

        const res = await fetch(`/api/courses?${params}`);
        if (!res.ok) return;

        const data = await res.json();
        if (append) {
          setCourses((prev) => [...prev, ...data.courses]);
        } else {
          setCourses(data.courses);
        }
        setPagination(data.pagination);
        currentPageRef.current = data.pagination.page;
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchCourses(1, searchParams.get("search") || "", false);
  }, [fetchCourses, searchParams]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (value) params.set("search", value);
      router.push(`/explore${params.toString() ? "?" + params : ""}`);
    }, 300);
  }

  function handleLoadMore() {
    fetchCourses(currentPageRef.current + 1, search, true);
  }

  const hasMore = pagination ? pagination.page < pagination.pages : false;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Explore courses
        </h1>
        <div className="mt-4 max-w-xl mx-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by topic, skill, or keyword..."
            className="w-full px-4 py-3 text-base rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            {search
              ? `No courses found for '${search}'. Be the first to create one!`
              : "No courses available yet. Check back soon!"}
          </p>
          {search && (
            <Link
              href="/register"
              className="mt-4 inline-block px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500"
            >
              Get Started
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Link
                key={course._id}
                href={`/courses/${course._id}`}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-md transition-shadow"
              >
                {course.coverImage ? (
                  <div className="aspect-video relative">
                    <img
                      src={course.coverImage}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                    <span className="text-white text-5xl font-bold opacity-80">
                      {course.title.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    {course.description}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {getLessonCount(course.modules)} lessons
                    </span>
                    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {course.enrolledCount} learners
                    </span>
                    {course.youtubeMetadata?.skillLevel && (
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                        {course.youtubeMetadata.skillLevel}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more courses"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
