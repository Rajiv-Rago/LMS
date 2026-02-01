"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type TargetLevel = "beginner" | "intermediate" | "advanced";
type GenerationPhase = "idle" | "submitting" | "designing" | "creating-modules" | "setting-up" | "complete";

const phaseMessages: Record<GenerationPhase, string> = {
  idle: "",
  submitting: "Submitting request...",
  designing: "Designing curriculum...",
  "creating-modules": "Creating modules...",
  "setting-up": "Setting up lessons...",
  complete: "Complete!",
};

export default function NewAICoursePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    topic: "",
    targetLevel: "beginner" as TargetLevel,
    estimatedDuration: "",
    additionalContext: "",
    provider: "",
    model: "",
  });
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isGenerating = phase !== "idle";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPhase("submitting");

    try {
      // Simulate phase progression for better UX
      const phaseTimer = setTimeout(() => setPhase("designing"), 1000);
      const phase2Timer = setTimeout(() => setPhase("creating-modules"), 5000);
      const phase3Timer = setTimeout(() => setPhase("setting-up"), 10000);

      const payload: Record<string, string> = {
        topic: formData.topic,
        targetLevel: formData.targetLevel,
        estimatedDuration: formData.estimatedDuration,
      };

      if (formData.additionalContext) {
        payload.additionalContext = formData.additionalContext;
      }
      if (formData.provider) {
        payload.provider = formData.provider;
      }
      if (formData.model) {
        payload.model = formData.model;
      }

      const res = await fetch("/api/courses/ai/syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      clearTimeout(phaseTimer);
      clearTimeout(phase2Timer);
      clearTimeout(phase3Timer);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate course");
      }

      setPhase("complete");
      setTimeout(() => {
        router.push(`/courses/${data.course._id}`);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate course");
      setPhase("idle");
    }
  };

  const getProgress = () => {
    switch (phase) {
      case "submitting": return 10;
      case "designing": return 35;
      case "creating-modules": return 65;
      case "setting-up": return 85;
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
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-5">
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
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Any specific topics to cover, learning goals, or prerequisites..."
              />
            </div>

            {/* Advanced Settings */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                Advanced Settings
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 pl-6 border-l-2 border-zinc-200 dark:border-zinc-700">
                  <div>
                    <label
                      htmlFor="provider"
                      className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      AI Provider (optional)
                    </label>
                    <select
                      id="provider"
                      disabled={isGenerating}
                      value={formData.provider}
                      onChange={(e) =>
                        setFormData({ ...formData, provider: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Use default</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="gemini">Gemini</option>
                      <option value="groq">Groq</option>
                      <option value="cerebras">Cerebras</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="model"
                      className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Model (optional)
                    </label>
                    <input
                      id="model"
                      type="text"
                      disabled={isGenerating}
                      value={formData.model}
                      onChange={(e) =>
                        setFormData({ ...formData, model: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="e.g., gpt-4o, claude-3-opus"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Progress Indicator */}
            {isGenerating && (
              <div className="rounded-md bg-purple-50 dark:bg-purple-900/20 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent"></div>
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    {phaseMessages[phase]}
                  </span>
                </div>
                <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${getProgress()}%` }}
                  ></div>
                </div>
                <p className="text-xs text-purple-600 dark:text-purple-400">
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
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-md hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
