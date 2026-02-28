"use client";

import React from "react";
import { LearningModule, PathVariant } from "@/lib/types";

interface AlternativePathsProps {
  variants: PathVariant[];
  modules: LearningModule[];
  activeVariant: string;
  onSwitch: (variant: "fast_track" | "standard" | "deep_dive") => void;
}

export default function AlternativePaths({
  variants,
  modules,
  activeVariant,
  onSwitch,
}: AlternativePathsProps) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-yt-gray-1 mb-3">Path mode</h2>
      <div className="flex gap-2">
        {variants.map((v) => {
          const videoCount = modules
            .filter((m) => v.moduleIds.includes(m.id))
            .reduce((sum, m) => sum + m.videos.length, 0);
          return (
            <button
              key={v.name}
              onClick={() => onSwitch(v.name)}
              className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${
                activeVariant === v.name
                  ? "border-yt-red bg-yt-red/10"
                  : "border-yt-dark-4 bg-yt-dark-3 hover:border-yt-gray-3"
              }`}
            >
              <div className="text-sm font-semibold text-white">{v.label}</div>
              <div className="text-xs text-yt-gray-2 mt-0.5">
                {videoCount} videos | {v.totalHours}h
              </div>
              <div className="text-xs text-yt-gray-3 mt-1">{v.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
