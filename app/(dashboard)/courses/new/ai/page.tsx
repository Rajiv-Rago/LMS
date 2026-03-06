"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ModelSelector, ModelSelectorValue } from "@/components/ai/ModelSelector";
import { useUserAIDefaults } from "@/lib/hooks/useUserAIDefaults";

type TargetLevel = "beginner" | "intermediate" | "advanced";
type GenerationPhase = "idle" | "submitting" | "generating" | "complete";

const phaseMessages: Record<GenerationPhase, string> = {
  idle: "",
  submitting: "Submitting request...",
  generating: "Generating course content...",
  complete: "Complete!",
};

export default function NewAICoursePage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [formData, setFormData] = useState({
    topic: "",
    targetLevel: "beginner" as TargetLevel,
    estimatedDuration: "",
    additionalContext: "",
    includeVideos: false,
  });

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
  const userDefaults = useUserAIDefaults();
  const [modelValue, setModelValue] = useState<ModelSelectorValue>({
    tier: "balanced",
  });

  useEffect(() => {
    if (!userDefaults.loading) {
      setModelValue(userDefaults.value);
    }
  }, [userDefaults.loading, userDefaults.value]);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isGenerating = phase !== "idle";

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollJobStatus = useCallback(
    (jobId: string) => {
      setPhase("generating");

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`);
          if (!res.ok) return;

          const data = await res.json();
          const job = data.job;

          if (job.status === "completed") {
            stopPolling();
            setPhase("complete");
            const courseId = job.result?.courseId;
            if (courseId) {
              setTimeout(() => router.push(`/courses/${courseId}`), 500);
            }
          } else if (job.status === "failed") {
            stopPolling();
            setError(job.error || "Generation failed");
            setPhase("idle");
          }
        } catch {
          // Silently retry on network errors
        }
      }, 2000);
    },
    [router, stopPolling]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPhase("submitting");

    try {
      const payload: Record<string, string | boolean> = {
        topic: formData.topic,
        targetLevel: formData.targetLevel,
        estimatedDuration: formData.estimatedDuration,
      };

      if (formData.additionalContext) {
        payload.additionalContext = formData.additionalContext;
      }
      if (formData.includeVideos) {
        payload.includeVideos = true;
      }
      if (modelValue.tier) {
        payload.tier = modelValue.tier;
      }
      if (modelValue.provider) {
        payload.provider = modelValue.provider;
      }
      if (modelValue.model) {
        payload.model = modelValue.model;
      }

      const res = await fetch("/api/courses/ai/syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate course");
      }

      if (data.jobId) {
        // Async mode: poll for job completion
        pollJobStatus(data.jobId);
      } else if (data.course) {
        // Sync mode (SyncShim completed inline)
        setPhase("complete");
        setTimeout(() => router.push(`/courses/${data.course._id}`), 500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate course");
      setPhase("idle");
    }
  };

  const getProgress = () => {
    switch (phase) {
      case "submitting": return 15;
      case "generating": return 55;
      case "complete": return 100;
      default: return 0;
    }
  };

  if (checkingAuth || !authorized) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/courses"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to courses
        </Link>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/20">
              <svg
                className="w-6 h-6 text-white"
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
            <div>
              <h1 className="text-xl font-bold text-white">Create Course with AI</h1>
              <p className="text-sm text-white/80">
                Describe your topic and we&apos;ll generate a complete course
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
                <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
              </div>
            )}

            <div>
              <label
                htmlFor="topic"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                What do you want to learn?
              </label>
              <input
                id="topic"
                type="text"
                required
                disabled={isGenerating}
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="e.g., Python programming for beginners, Machine learning fundamentals"
              />
            </div>

            <div>
              <label
                htmlFor="targetLevel"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Experience Level
              </label>
              <select
                id="targetLevel"
                required
                disabled={isGenerating}
                value={formData.targetLevel}
                onChange={(e) =>
                  setFormData({ ...formData, targetLevel: e.target.value as TargetLevel })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="estimatedDuration"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Estimated Course Length
              </label>
              <input
                id="estimatedDuration"
                type="text"
                required
                disabled={isGenerating}
                value={formData.estimatedDuration}
                onChange={(e) =>
                  setFormData({ ...formData, estimatedDuration: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="e.g., 4 weeks, 20 hours, 10 lessons"
              />
            </div>

            <div>
              <label
                htmlFor="additionalContext"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Additional Details (optional)
              </label>
              <textarea
                id="additionalContext"
                rows={3}
                disabled={isGenerating}
                value={formData.additionalContext}
                onChange={(e) =>
                  setFormData({ ...formData, additionalContext: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Any specific topics to cover, learning goals, or prerequisites..."
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                id="includeVideos"
                type="checkbox"
                disabled={isGenerating}
                checked={formData.includeVideos}
                onChange={(e) =>
                  setFormData({ ...formData, includeVideos: e.target.checked })
                }
                className="mt-1 h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="includeVideos" className="text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Include YouTube videos
                </span>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Mix AI-written text lessons with curated YouTube videos for a richer learning experience
                </p>
              </label>
            </div>

            <ModelSelector
              value={modelValue}
              onChange={setModelValue}
              disabled={isGenerating}
            />

            {/* Progress Indicator */}
            {isGenerating && (
              <div className="rounded-md bg-violet-50 dark:bg-violet-900/20 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-violet-600 border-t-transparent"></div>
                  <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                    {phaseMessages[phase]}
                  </span>
                </div>
                <div className="w-full bg-violet-200 dark:bg-violet-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${getProgress()}%` }}
                  ></div>
                </div>
                <p className="text-xs text-violet-600 dark:text-violet-400">
                  This may take 15-30 seconds
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href="/courses"
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isGenerating}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-md hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? "Generating..." : "Generate Course"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
