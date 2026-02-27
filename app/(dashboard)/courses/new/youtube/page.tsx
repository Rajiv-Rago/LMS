"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ModelSelector, ModelSelectorValue } from "@/components/ai/ModelSelector";
import { useUserAIDefaults } from "@/lib/hooks/useUserAIDefaults";

type SkillLevel = "complete_beginner" | "some_basics" | "intermediate" | "advanced";
type PathVariant = "fast_track" | "standard" | "deep_dive";
type GenerationPhase = "idle" | "submitting" | "generating" | "complete";

const phaseMessages: Record<GenerationPhase, string> = {
  idle: "",
  submitting: "Submitting request...",
  generating: "Searching YouTube & building your path...",
  complete: "Complete!",
};

export default function NewYouTubeCoursePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    topic: "",
    skillLevel: "complete_beginner" as SkillLevel,
    teachingStyle: "",
    videoLengthPreference: "any" as "short" | "medium" | "long" | "any",
    pathVariant: "standard" as PathVariant,
  });
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
      const payload: Record<string, string> = {
        topic: formData.topic,
        skillLevel: formData.skillLevel,
        pathVariant: formData.pathVariant,
        videoLengthPreference: formData.videoLengthPreference,
      };

      if (formData.teachingStyle) {
        payload.teachingStyle = formData.teachingStyle;
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

      const res = await fetch("/api/courses/youtube/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate path");
      }

      if (data.jobId) {
        pollJobStatus(data.jobId);
      } else if (data.course) {
        setPhase("complete");
        setTimeout(() => router.push(`/courses/${data.course._id}`), 500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate path");
      setPhase("idle");
    }
  };

  const getProgress = () => {
    switch (phase) {
      case "submitting": return 10;
      case "generating": return 50;
      case "complete": return 100;
      default: return 0;
    }
  };

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
        <div className="bg-gradient-to-r from-red-600 to-indigo-600 px-6 py-5">
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
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Create from YouTube</h1>
              <p className="text-sm text-white/80">
                We&apos;ll find the best tutorials and organize them into a real learning path
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
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="e.g., Docker for beginners, React hooks, System design"
              />
            </div>

            <div>
              <label
                htmlFor="skillLevel"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Your current level
              </label>
              <select
                id="skillLevel"
                required
                disabled={isGenerating}
                value={formData.skillLevel}
                onChange={(e) =>
                  setFormData({ ...formData, skillLevel: e.target.value as SkillLevel })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="complete_beginner">Complete beginner</option>
                <option value="some_basics">Know some basics</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="pathVariant"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Path style
              </label>
              <select
                id="pathVariant"
                disabled={isGenerating}
                value={formData.pathVariant}
                onChange={(e) =>
                  setFormData({ ...formData, pathVariant: e.target.value as PathVariant })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="fast_track">Fast track — just the essentials</option>
                <option value="standard">Standard — solid coverage</option>
                <option value="deep_dive">Deep dive — comprehensive</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="teachingStyle"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Preferred teaching style (optional)
              </label>
              <input
                id="teachingStyle"
                type="text"
                disabled={isGenerating}
                value={formData.teachingStyle}
                onChange={(e) => setFormData({ ...formData, teachingStyle: e.target.value })}
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="e.g., project-based, code-along, visual/animated"
              />
            </div>

            <div>
              <label
                htmlFor="videoLength"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Video length preference
              </label>
              <select
                id="videoLength"
                disabled={isGenerating}
                value={formData.videoLengthPreference}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    videoLengthPreference: e.target.value as "short" | "medium" | "long" | "any",
                  })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="any">Any length</option>
                <option value="short">Short (under 15 min)</option>
                <option value="medium">Medium (15-45 min)</option>
                <option value="long">Long (45+ min, full courses)</option>
              </select>
            </div>

            <ModelSelector
              value={modelValue}
              onChange={setModelValue}
              disabled={isGenerating}
            />

            {/* Progress Indicator */}
            {isGenerating && (
              <div className="rounded-md bg-indigo-50 dark:bg-indigo-900/20 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent"></div>
                  <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    {phaseMessages[phase]}
                  </span>
                </div>
                <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-red-600 to-indigo-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${getProgress()}%` }}
                  ></div>
                </div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  This may take 30-60 seconds (searching YouTube + building curriculum)
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
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-indigo-600 rounded-md hover:from-red-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? "Generating..." : "Build Learning Path"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
