"use client";

import React from "react";
import Checkbox from "@/components/ui/Checkbox";
import { PathFormData, ExcludeFilter, IncludeFilter } from "@/lib/types";

interface FiltersStepProps {
  data: PathFormData;
  onChange: (updates: Partial<PathFormData>) => void;
}

const EXCLUDE_OPTIONS: { value: ExcludeFilter; label: string; desc: string }[] = [
  { value: "outdated", label: "Outdated content", desc: "Videos over 2 years old" },
  { value: "clickbait", label: "Clickbait titles", desc: "Misleading or sensationalized titles" },
  { value: "low_quality", label: "Low production quality", desc: "Poor audio, video, or presentation" },
  { value: "non_english", label: "Non-English", desc: "Only include English-language content" },
];

const INCLUDE_OPTIONS: { value: IncludeFilter; label: string; desc: string }[] = [
  { value: "exercises", label: "Practice exercises", desc: "Videos with assignments or drills" },
  { value: "projects", label: "Project tutorials", desc: "Build something real" },
  { value: "quizzes", label: "Quizzes / assessments", desc: "Test your understanding" },
  { value: "resources", label: "Downloadable resources", desc: "Code, templates, cheat sheets" },
];

function toggleArray<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export default function FiltersStep({ data, onChange }: FiltersStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Content filters</h2>
        <p className="text-yt-gray-2 text-sm">
          Fine-tune what gets included in your learning path.
        </p>
      </div>

      {/* Exclude */}
      <div>
        <h3 className="text-sm font-medium text-yt-gray-1 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          Exclude
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EXCLUDE_OPTIONS.map((opt) => (
            <Checkbox
              key={opt.value}
              label={opt.label}
              description={opt.desc}
              checked={data.excludeFilters.includes(opt.value)}
              onChange={() =>
                onChange({
                  excludeFilters: toggleArray(data.excludeFilters, opt.value),
                })
              }
            />
          ))}
        </div>
      </div>

      {/* Include */}
      <div>
        <h3 className="text-sm font-medium text-yt-gray-1 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Prefer videos with
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {INCLUDE_OPTIONS.map((opt) => (
            <Checkbox
              key={opt.value}
              label={opt.label}
              description={opt.desc}
              checked={data.includeFilters.includes(opt.value)}
              onChange={() =>
                onChange({
                  includeFilters: toggleArray(data.includeFilters, opt.value),
                })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
