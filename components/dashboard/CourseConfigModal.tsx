"use client";

import { useEffect, useRef, useState } from "react";

export type ComplexityOption = "foundations" | "standard" | "deep";

export interface CourseConfig {
  topic: string;
  complexity: ComplexityOption;
  passingScore: number;
  additionalContext: string;
}

interface CourseConfigModalProps {
  initialTopic: string;
  onClose: () => void;
  onContinue: (config: CourseConfig) => void;
}

const COMPLEXITY_OPTIONS: { value: ComplexityOption; label: string; hint: string }[] = [
  { value: "foundations", label: "Foundations", hint: "Fewer modules, concise lessons" },
  { value: "standard", label: "Standard", hint: "Balanced modules and depth" },
  { value: "deep", label: "Deep", hint: "More modules, thorough lessons" },
];

export default function CourseConfigModal({ initialTopic, onClose, onContinue }: CourseConfigModalProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [complexity, setComplexity] = useState<ComplexityOption>("standard");
  const [passingScore, setPassingScore] = useState(70);
  const [additionalContext, setAdditionalContext] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    onContinue({
      topic: topic.trim(),
      complexity,
      passingScore,
      additionalContext: additionalContext.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="course-config-title">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={dialogRef}
        className="relative z-10 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 rounded-t-xl">
          <h2 id="course-config-title" className="text-lg font-bold text-white">
            Configure your course
          </h2>
          <p className="text-sm text-white/80">
            Tell us how deep to go and what to include
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label htmlFor="config-topic" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Topic
            </label>
            <input
              id="config-topic"
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g., Linear Algebra"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Complexity
            </span>
            <div className="grid grid-cols-3 gap-2">
              {COMPLEXITY_OPTIONS.map(({ value, label, hint }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setComplexity(value)}
                  aria-pressed={complexity === value}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    complexity === value
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                      : "border-zinc-300 dark:border-zinc-700 hover:border-indigo-300"
                  }`}
                >
                  <span className="block text-sm font-semibold text-zinc-900 dark:text-white">{label}</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="config-passing" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Passing score: {passingScore}%
            </label>
            <input
              id="config-passing"
              type="range"
              min={0}
              max={100}
              step={5}
              value={passingScore}
              onChange={(e) => setPassingScore(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-600"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Required on each end-of-module test for the module to count as completed.
            </p>
          </div>

          <div>
            <label htmlFor="config-context" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Details, topics, or course description
            </label>
            <textarea
              id="config-context"
              rows={5}
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Paste anything you want covered: topics, goals, prerequisites — even a full university course description..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!topic.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-md disabled:opacity-50 transition-all"
            >
              Continue to assessment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
