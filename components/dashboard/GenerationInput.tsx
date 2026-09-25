"use client";

import { useState } from "react";

interface GenerationInputProps {
  onSubmit: (topic: string) => void;
  disabled?: boolean;
  limitReached?: boolean;
  showWelcome?: boolean;
}

const SUGGESTION_CHIPS = [
  "Python for Beginners",
  "Web Development Basics",
  "Data Science Fundamentals",
  "Machine Learning 101",
];

export default function GenerationInput({
  onSubmit,
  disabled = false,
  limitReached = false,
  showWelcome = false,
}: GenerationInputProps) {
  const [topic, setTopic] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || disabled || limitReached) return;
    onSubmit(topic.trim());
  }

  return (
    <div className="space-y-4">
      {showWelcome && (
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Start learning anything
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            Type a topic below and we&apos;ll create a personalized course for you
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What do you want to learn?"
            disabled={disabled}
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={disabled || limitReached || !topic.trim()}
            className="ml-auto px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {disabled ? "Generating..." : "Generate"}
          </button>
        </div>
      </form>

      {limitReached && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          You&apos;ve reached the limit of 5 generated courses
        </p>
      )}

      {showWelcome && !limitReached && (
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setTopic(chip)}
              className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
