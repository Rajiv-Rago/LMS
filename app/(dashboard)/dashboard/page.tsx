"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import GenerationInput from "@/components/dashboard/GenerationInput";
import GeneratingCard from "@/components/dashboard/GeneratingCard";
import CourseSection from "@/components/dashboard/CourseSection";
import { useJobPoller, JobResult } from "@/lib/hooks/useJobPoller";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

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

type GenerationPhase = "idle" | "submitting" | "generating" | "complete";

export default function DashboardPage() {
  const router = useRouter();
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>("idle");
  const [generatingTopic, setGeneratingTopic] = useState("");
  const [error, setError] = useState("");

  const handleComplete = useCallback(
    (result: JobResult) => {
      setGenerationPhase("complete");
      const courseId = (result.result as { courseId?: string })?.courseId;
      if (courseId) {
        router.push(`/courses/${courseId}`);
      }
    },
    [router]
  );

  const handleFailed = useCallback((result: JobResult) => {
    setError(result.error || "Generation failed");
    setGenerationPhase("idle");
    setGeneratingTopic("");
  }, []);

  const { addJobs } = useJobPoller({
    onComplete: handleComplete,
    onFailed: handleFailed,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [myRes, enrolledRes] = await Promise.all([
          fetch("/api/courses/ai/my-courses"),
          fetch("/api/courses?enrolled=true"),
        ]);

        if (myRes.ok) {
          const data = await myRes.json();
          setMyCourses(data.courses || []);
        }

        if (enrolledRes.ok) {
          const data = await enrolledRes.json();
          setEnrolledCourses(data.courses || []);
        }
      } catch {
        // Handled by error boundary
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleGenerate(topic: string, skillLevel: string) {
    setError("");
    setGenerationPhase("submitting");
    setGeneratingTopic(topic);

    try {
      const res = await fetch("/api/courses/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ topic, skillLevel }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setError(data.error || "Rate limit reached. Please try again later.");
        setGenerationPhase("idle");
        setGeneratingTopic("");
        return;
      }

      if (res.status === 503) {
        setError("AI service is temporarily unavailable. Please try again later.");
        setGenerationPhase("idle");
        setGeneratingTopic("");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start generation");
      }

      const data = await res.json();
      setGenerationPhase("generating");
      addJobs([{ jobId: data.jobId, meta: { topic } }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start generation");
      setGenerationPhase("idle");
      setGeneratingTopic("");
    }
  }

  const courseCount = myCourses.length;
  const limitReached = courseCount >= 5;
  const isEmpty = myCourses.length === 0 && enrolledCourses.length === 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <GenerationInput
        onSubmit={handleGenerate}
        disabled={generationPhase !== "idle"}
        limitReached={limitReached}
        showWelcome={isEmpty}
      />

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {generationPhase === "generating" && generatingTopic && (
        <GeneratingCard
          topic={generatingTopic}
          onCancel={() => {
            setGenerationPhase("idle");
            setGeneratingTopic("");
          }}
        />
      )}

      <CourseSection
        title="My Courses"
        courses={myCourses}
        emptyMessage="You haven't generated any courses yet"
      />

      <CourseSection
        title="Enrolled Courses"
        courses={enrolledCourses}
        emptyMessage="You haven't enrolled in any courses yet"
      />
    </div>
  );
}
