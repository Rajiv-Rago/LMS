"use client";

import React from "react";
import { LearningModule, LearningPath, PathProgress } from "@/lib/types";

interface PathSummaryProps {
  path: LearningPath;
  progress: PathProgress;
  visibleModules: LearningModule[];
}

export default function PathSummary({ path, progress, visibleModules }: PathSummaryProps) {
  const { summary } = path;

  const allVideos = visibleModules.flatMap((m) => m.videos);
  const watchedCount = allVideos.filter(
    (v) => progress.videoProgress[v.videoId]?.status === "watched"
  ).length;
  const completionPct = allVideos.length > 0
    ? Math.round((watchedCount / allVideos.length) * 100)
    : 0;

  const hoursWatched = allVideos
    .filter((v) => progress.videoProgress[v.videoId]?.status === "watched")
    .reduce((sum, v) => sum + v.durationSeconds, 0) / 3600;

  return (
    <div className="bg-gradient-to-r from-yt-dark-2 to-yt-dark-1 rounded-2xl p-6 border border-yt-dark-4">
      {/* Title */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">
            Learn {summary.topic}
          </h1>
          <p className="text-yt-gray-2 text-sm">
            Your personalized YouTube learning path
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-yt-red">{completionPct}%</div>
          <div className="text-xs text-yt-gray-2">complete</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Videos" value={`${watchedCount}/${allVideos.length}`} />
        <StatCard label="Video time" value={`${summary.totalVideoHours}h`} />
        <StatCard
          label="Hours watched"
          value={`${Math.round(hoursWatched * 10) / 10}h`}
        />
        <StatCard label="Timeline" value={`${summary.completionWeeks} weeks`} />
        <StatCard
          label="Streak"
          value={`${progress.streakDays} day${progress.streakDays !== 1 ? "s" : ""}`}
        />
      </div>

      {/* Progress bar */}
      <div className="mt-5">
        <div className="flex justify-between text-xs text-yt-gray-2 mb-1">
          <span>Start: {summary.startDate}</span>
          <span>Target: {summary.finishDate}</span>
        </div>
        <div className="w-full h-2 bg-yt-dark-4 rounded-full overflow-hidden">
          <div
            className="h-full bg-yt-red rounded-full transition-all duration-700"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-yt-dark-3/50 rounded-xl p-3 text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-yt-gray-2 mt-0.5">{label}</div>
    </div>
  );
}
