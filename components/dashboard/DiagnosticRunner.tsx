"use client";

import { useState } from "react";
import type { CourseConfig } from "./CourseConfigModal";

interface DiagnosticMcq {
  question: string;
  options: string[];
  correctIndex: number;
  topic?: string;
}

interface DiagnosticRunnerProps {
  config: CourseConfig;
  onBack: () => void;
  onComplete: (knowledgeProfile: string) => void;
}

export default function DiagnosticRunner({ config, onBack, onComplete }: DiagnosticRunnerProps) {
  const [round, setRound] = useState(1);
  const [mcqs, setMcqs] = useState<DiagnosticMcq[]>([]);
  const [essayPrompt, setEssayPrompt] = useState("");
  const [answers, setAnswers] = useState<number[]>([]);
  const [essayResponse, setEssayResponse] = useState("");
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);

  async function fetchQuestions(nextRound: number, gaps: string[]) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/courses/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({
          action: "questions",
          topic: config.topic,
          complexity: config.complexity,
          additionalContext: config.additionalContext || undefined,
          round: nextRound,
          weakTopics: gaps.length ? gaps : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load assessment");
      setMcqs(data.mcqs);
      setEssayPrompt(data.essayPrompt);
      setAnswers(new Array(data.mcqs.length).fill(-1));
      setEssayResponse("");
      setRound(nextRound);
      setStarted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assessment");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitRound(e: React.FormEvent) {
    e.preventDefault();
    if (answers.some((a) => a < 0) || !essayResponse.trim()) return;
    setEvaluating(true);
    setError("");
    try {
      const res = await fetch("/api/courses/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({
          action: "evaluate",
          topic: config.topic,
          mcqs: mcqs.map((m, i) => ({ ...m, userAnswer: answers[i] })),
          essayPrompt,
          essayResponse: essayResponse.trim(),
          round,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to evaluate assessment");

      const nextProfiles = [...profiles, data.knowledgeProfile as string];
      setProfiles(nextProfiles);
      setWeakTopics(data.weakTopics ?? []);

      if (data.done) {
        onComplete(nextProfiles.join("\n"));
      } else {
        await fetchQuestions(data.nextRound ?? round + 1, data.weakTopics ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate assessment");
    } finally {
      setEvaluating(false);
    }
  }

  function handleSkip() {
    onComplete(profiles.join("\n"));
  }

  if (!started) {
    return (
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
            Quick knowledge check: {config.topic}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            We&apos;ll ask 3 multiple-choice questions plus 1 short written answer per round
            to gauge what you already know. The agent adapts each round to your gaps.
          </p>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => fetchQuestions(1, [])}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-md disabled:opacity-50"
          >
            {loading ? "Preparing..." : "Start assessment"}
          </button>
          <button type="button" onClick={handleSkip} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitRound} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
          Knowledge check — round {round}
        </h3>
        <button type="button" onClick={handleSkip} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          Skip &amp; generate
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="space-y-5">
        {mcqs.map((mcq, qi) => (
          <fieldset key={qi} className="space-y-2">
            <legend className="text-sm font-medium text-zinc-900 dark:text-white">
              {qi + 1}. {mcq.question}
            </legend>
            <div className="space-y-1.5">
              {mcq.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    answers[qi] === oi
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-indigo-300"
                  }`}
                >
                  <input
                    type="radio"
                    name={`mcq-${qi}`}
                    checked={answers[qi] === oi}
                    onChange={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                    className="accent-indigo-600"
                  />
                  <span className="text-zinc-700 dark:text-zinc-300">{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="space-y-2">
        <label htmlFor="diagnostic-essay" className="block text-sm font-medium text-zinc-900 dark:text-white">
          Written answer: {essayPrompt}
        </label>
        <textarea
          id="diagnostic-essay"
          rows={4}
          value={essayResponse}
          onChange={(e) => setEssayResponse(e.target.value)}
          className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Explain in your own words — this helps gauge depth of knowledge..."
        />
      </div>

      {weakTopics.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Adapting to gaps: {weakTopics.slice(0, 3).join("; ")}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={evaluating || loading || answers.some((a) => a < 0) || !essayResponse.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-md disabled:opacity-50"
        >
          {evaluating ? "Evaluating..." : "Submit round"}
        </button>
      </div>
    </form>
  );
}
