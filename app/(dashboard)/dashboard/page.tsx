"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import GenerationInput from "@/components/dashboard/GenerationInput";
import GeneratingCard from "@/components/dashboard/GeneratingCard";
import CourseSection from "@/components/dashboard/CourseSection";
import EmptyState from "@/components/ui/EmptyState";
import { useJobPoller, JobResult } from "@/lib/hooks/useJobPoller";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useConfirm } from "@/lib/hooks/useConfirm";
import { useToast } from "@/lib/hooks/useToast";

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
  const confirm = useConfirm();
  const toast = useToast();
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>("idle");
  const [generatingTopic, setGeneratingTopic] = useState("");
  const [error, setError] = useState("");
  const [courseLimit, setCourseLimit] = useState(5);

  const handleComplete = useCallback(
    (result: JobResult) => {
      setGenerationPhase("complete");
      const courseId = (result.result as { courseId?: string })?.courseId;
      if (courseId) {
        router.push(`/courses/${courseId}/overview`);
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
        const [myRes, meRes] = await Promise.all([
          fetch("/api/courses/ai/my-courses"),
          fetch("/api/auth/me"),
        ]);

        if (myRes.ok) {
          const data = await myRes.json();
          setMyCourses(data.courses || []);
        }

        if (meRes.ok) {
          const data = await meRes.json();
          const tier = data.user?.role === "admin" ? "admin" : (data.user?.subscriptionTier || "free");
          if (tier !== "free") setCourseLimit(Infinity);
        }
      } catch {
        // Handled by error boundary
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleDelete(courseId: string, courseTitle: string) {
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
        setMyCourses((prev) => prev.filter((c) => c._id !== courseId));
        toast.success("Course deleted");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete course");
      }
    } catch {
      toast.error("Failed to delete course");
    }
  }

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

  const limitReached = isFinite(courseLimit) && myCourses.length >= courseLimit;
  const isEmpty = myCourses.length === 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        onDelete={handleDelete}
        emptyState={
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Generate your first course to get started"
            action={{
              label: "Generate Course",
              onClick: () => {
                window.scrollTo({ top: 0, behavior: "smooth" });
                const input = document.querySelector<HTMLInputElement>(
                  'input[placeholder="What do you want to learn?"]'
                );
                input?.focus();
              },
            }}
          />
        }
      />

    </div>
  );
}
