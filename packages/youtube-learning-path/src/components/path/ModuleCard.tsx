"use client";

import React, { useState } from "react";
import { LearningModule, PathProgress, VideoProgress } from "@/lib/types";
import VideoCard from "./VideoCard";

interface ModuleCardProps {
  module: LearningModule;
  progress: PathProgress;
  isActive: boolean;
  onVideoStatusChange: (videoId: string, status: VideoProgress["status"]) => void;
  onNotesChange: (videoId: string, notes: string) => void;
  onToggleCheck: (moduleId: string, index: number) => void;
  onProjectComplete: (title: string) => void;
}

export default function ModuleCard({
  module: mod,
  progress,
  isActive,
  onVideoStatusChange,
  onNotesChange,
  onToggleCheck,
  onProjectComplete,
}: ModuleCardProps) {
  const [expanded, setExpanded] = useState(isActive);

  // Sync expanded state when isActive changes (e.g. clicking roadmap)
  React.useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  const watchedCount = mod.videos.filter(
    (v) => progress.videoProgress[v.videoId]?.status === "watched"
  ).length;
  const pct =
    mod.videos.length > 0
      ? Math.round((watchedCount / mod.videos.length) * 100)
      : 0;
  const isCompleted = pct === 100;

  return (
    <div
      id={`module-${mod.id}`}
      className={`rounded-2xl border-2 transition-all ${
        isActive
          ? "border-yt-red/50 bg-yt-dark-1"
          : isCompleted
          ? "border-green-500/30 bg-yt-dark-1"
          : "border-yt-dark-4 bg-yt-dark-1"
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 text-left flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
              isCompleted
                ? "bg-green-500 text-white"
                : isActive
                ? "bg-yt-red text-white"
                : "bg-yt-dark-4 text-yt-gray-2"
            }`}
          >
            {isCompleted ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              mod.number
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{mod.name}</h3>
            <p className="text-sm text-yt-gray-2">
              {mod.videos.length} videos | {mod.estimatedHours}h |{" "}
              {mod.estimatedWeeks} week{mod.estimatedWeeks !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white">
              {watchedCount}/{mod.videos.length}
            </div>
            <div className="w-20 h-1.5 bg-yt-dark-4 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full transition-all ${
                  isCompleted ? "bg-green-500" : "bg-yt-red"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-yt-gray-2 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Module description */}
          <p className="text-sm text-yt-gray-2 bg-yt-dark-3 rounded-lg p-3">
            {mod.description}
          </p>

          {/* Videos */}
          <div className="space-y-3">
            {mod.videos.map((video, i) => (
              <VideoCard
                key={video.videoId}
                video={video}
                index={i}
                progress={progress.videoProgress[video.videoId]}
                onStatusChange={onVideoStatusChange}
                onNotesChange={onNotesChange}
              />
            ))}
          </div>

          {/* Module check */}
          {mod.moduleCheck && (
            <div className="bg-yt-dark-3 rounded-xl p-4 border border-yt-dark-4">
              <h4 className="text-sm font-semibold text-white mb-3">
                {mod.moduleCheck.description}
              </h4>
              <div className="space-y-2">
                {mod.moduleCheck.items.map((item, i) => {
                  const checked =
                    progress.moduleChecks[mod.id]?.[i] || false;
                  return (
                    <label
                      key={i}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div
                        onClick={() => onToggleCheck(mod.id, i)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                          checked
                            ? "bg-green-500 border-green-500"
                            : "border-yt-dark-4 group-hover:border-yt-gray-3"
                        }`}
                      >
                        {checked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span
                        className={`text-sm ${
                          checked ? "text-yt-gray-2 line-through" : "text-white"
                        }`}
                      >
                        {item}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Practice project */}
          {mod.practiceProject && (
            <div className="bg-gradient-to-r from-yt-red/5 to-transparent rounded-xl p-4 border border-yt-red/20">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-yt-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span className="text-xs font-medium text-yt-red uppercase tracking-wider">
                      Practice Project
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white">
                    {mod.practiceProject.title}
                  </h4>
                  <p className="text-xs text-yt-gray-2 mt-1">
                    {mod.practiceProject.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-yt-gray-3">
                    <span className="capitalize">
                      {mod.practiceProject.difficulty}
                    </span>
                    <span>{mod.practiceProject.estimatedHours}h estimated</span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    onProjectComplete(mod.practiceProject!.title)
                  }
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    progress.projectsCompleted.includes(
                      mod.practiceProject.title
                    )
                      ? "bg-green-500/20 text-green-400"
                      : "bg-yt-dark-4 text-yt-gray-2 hover:text-white"
                  }`}
                >
                  {progress.projectsCompleted.includes(
                    mod.practiceProject.title
                  )
                    ? "Completed"
                    : "Mark Done"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
