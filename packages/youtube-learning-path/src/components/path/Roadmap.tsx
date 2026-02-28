"use client";

import React from "react";
import { LearningModule, PathProgress } from "@/lib/types";

interface RoadmapProps {
  modules: LearningModule[];
  progress: PathProgress;
  activeModuleId: string | null;
  onModuleClick: (moduleId: string) => void;
}

export default function Roadmap({
  modules,
  progress,
  activeModuleId,
  onModuleClick,
}: RoadmapProps) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-white mb-4">Learning Roadmap</h2>
      <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
        {modules.map((mod, i) => {
          const watchedInModule = mod.videos.filter(
            (v) => progress.videoProgress[v.videoId]?.status === "watched"
          ).length;
          const pct =
            mod.videos.length > 0
              ? Math.round((watchedInModule / mod.videos.length) * 100)
              : 0;
          const isActive = mod.id === activeModuleId;
          const isCompleted = pct === 100;

          // Check if previous module is complete (for "locked" state)
          const prevCompleted =
            i === 0 ||
            modules[i - 1].videos.every(
              (v) => progress.videoProgress[v.videoId]?.status === "watched"
            );

          return (
            <React.Fragment key={mod.id}>
              <button
                onClick={() => onModuleClick(mod.id)}
                className={`flex-shrink-0 w-44 rounded-xl p-4 border-2 transition-all text-left ${
                  isActive
                    ? "border-yt-red bg-yt-red/10"
                    : isCompleted
                    ? "border-green-500/50 bg-green-500/5"
                    : prevCompleted
                    ? "border-yt-dark-4 bg-yt-dark-3 hover:border-yt-gray-3"
                    : "border-yt-dark-4 bg-yt-dark-3/50 opacity-60"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : isActive
                        ? "bg-yt-red text-white"
                        : "bg-yt-dark-4 text-yt-gray-2"
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      mod.number
                    )}
                  </div>
                  <span className="text-xs text-yt-gray-2">
                    {mod.videos.length} videos
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white leading-tight mb-2 line-clamp-2">
                  {mod.name}
                </h3>
                <div className="text-xs text-yt-gray-2 mb-2">
                  {mod.estimatedHours}h | {mod.estimatedWeeks}w
                </div>
                {/* Mini progress bar */}
                <div className="w-full h-1 bg-yt-dark-4 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isCompleted ? "bg-green-500" : "bg-yt-red"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-yt-gray-2 mt-1">{pct}%</div>
              </button>
              {i < modules.length - 1 && (
                <div className="flex items-center px-1 flex-shrink-0">
                  <svg className="w-5 h-5 text-yt-dark-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
