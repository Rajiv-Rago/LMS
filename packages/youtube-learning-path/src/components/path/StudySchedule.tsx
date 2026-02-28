"use client";

import React from "react";
import { LearningPath, PathProgress } from "@/lib/types";

interface StudyScheduleProps {
  path: LearningPath;
  progress: PathProgress;
}

export default function StudySchedule({ path, progress }: StudyScheduleProps) {
  const videoMap = new Map(
    path.modules.flatMap((m) => m.videos).map((v) => [v.videoId, v])
  );

  return (
    <div className="bg-yt-dark-2 rounded-xl border border-yt-dark-4 p-5">
      <h2 className="text-lg font-bold text-white mb-4">Study Schedule</h2>
      <div className="space-y-3">
        {path.schedule.map((week) => {
          const videos = week.videoIds
            .map((id) => videoMap.get(id))
            .filter(Boolean);
          const watchedInWeek = videos.filter(
            (v) => v && progress.videoProgress[v.videoId]?.status === "watched"
          ).length;
          const pct =
            videos.length > 0
              ? Math.round((watchedInWeek / videos.length) * 100)
              : 0;

          return (
            <div
              key={week.week}
              className="bg-yt-dark-3 rounded-lg p-4 border border-yt-dark-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    Week {week.week}
                  </span>
                  <span className="text-xs text-yt-gray-2">
                    {week.totalHours}h
                  </span>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    pct === 100
                      ? "bg-green-500/20 text-green-400"
                      : pct > 0
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-yt-dark-4 text-yt-gray-2"
                  }`}
                >
                  {pct === 100
                    ? "Done"
                    : pct > 0
                    ? "In Progress"
                    : "Upcoming"}
                </span>
              </div>
              <div className="space-y-1">
                {videos.map(
                  (v) =>
                    v && (
                      <div
                        key={v.videoId}
                        className="flex items-center gap-2 text-xs"
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            progress.videoProgress[v.videoId]?.status ===
                            "watched"
                              ? "bg-green-500"
                              : "bg-yt-dark-4"
                          }`}
                        />
                        <span
                          className={
                            progress.videoProgress[v.videoId]?.status ===
                            "watched"
                              ? "text-yt-gray-2 line-through"
                              : "text-yt-gray-1"
                          }
                        >
                          {v.title}
                        </span>
                        <span className="text-yt-gray-3 ml-auto flex-shrink-0">
                          {v.duration}
                        </span>
                      </div>
                    )
                )}
              </div>
              {/* Progress bar */}
              <div className="w-full h-1 bg-yt-dark-4 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-yt-red rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
