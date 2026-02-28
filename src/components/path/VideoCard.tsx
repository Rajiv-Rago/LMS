"use client";

import React, { useState } from "react";
import Image from "next/image";
import { PathVideo, VideoProgress } from "@/lib/types";

interface VideoCardProps {
  video: PathVideo;
  index: number;
  progress: VideoProgress | undefined;
  onStatusChange: (videoId: string, status: VideoProgress["status"]) => void;
  onNotesChange: (videoId: string, notes: string) => void;
}

export default function VideoCard({
  video,
  index,
  progress,
  onStatusChange,
  onNotesChange,
}: VideoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const status = progress?.status || "unwatched";

  const statusColors = {
    unwatched: "border-yt-dark-4",
    watching: "border-yellow-500/50",
    watched: "border-green-500/50",
    skipped: "border-yt-gray-3/30",
  };

  const statusBadge = {
    unwatched: null,
    watching: (
      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
        In Progress
      </span>
    ),
    watched: (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
        Watched
      </span>
    ),
    skipped: (
      <span className="text-xs px-2 py-0.5 rounded-full bg-yt-dark-4 text-yt-gray-2">
        Skipped
      </span>
    ),
  };

  return (
    <div
      className={`bg-yt-dark-2 rounded-xl border-2 ${statusColors[status]} transition-all ${
        status === "skipped" ? "opacity-60" : ""
      }`}
    >
      {/* Main card */}
      <div className="p-4">
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="relative flex-shrink-0 w-40 h-24 rounded-lg overflow-hidden bg-yt-dark-4 group">
            {video.thumbnailUrl ? (
              <Image
                src={video.thumbnailUrl}
                alt={video.title}
                fill
                className="object-cover"
                sizes="160px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-10 h-10 text-yt-gray-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
            {/* Duration badge */}
            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
              {video.duration}
            </div>
            {/* Play overlay */}
            <a
              href={`https://www.youtube.com/watch?v=${video.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"
            >
              <svg
                className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </a>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-yt-gray-3">
                  #{index + 1}
                </span>
                {statusBadge[status]}
              </div>
            </div>
            <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2 mb-1">
              {video.title}
            </h3>
            <div className="flex items-center gap-3 text-xs text-yt-gray-2">
              <span>{video.channelName}</span>
              <span>{video.viewCount.toLocaleString()} views</span>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-yt-red hover:text-yt-red-hover mt-2 transition-colors"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-yt-dark-4 pt-3">
          {/* Why included */}
          <div>
            <h4 className="text-xs font-medium text-yt-gray-1 mb-1">
              Why this video
            </h4>
            <p className="text-sm text-yt-gray-2">{video.whyIncluded}</p>
          </div>

          {/* Key takeaways */}
          <div>
            <h4 className="text-xs font-medium text-yt-gray-1 mb-1">
              What you&apos;ll learn
            </h4>
            <ul className="space-y-1">
              {video.keyTakeaways.map((t, i) => (
                <li key={i} className="text-sm text-yt-gray-2 flex items-start gap-2">
                  <span className="text-yt-red mt-0.5">&#8226;</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Practice */}
          {video.practiceSuggestion && (
            <div className="bg-yt-dark-3 rounded-lg p-3">
              <h4 className="text-xs font-medium text-yt-gray-1 mb-1">
                Practice after watching
              </h4>
              <p className="text-sm text-yt-gray-2">
                {video.practiceSuggestion}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://www.youtube.com/watch?v=${video.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yt-red text-white text-xs font-medium rounded-lg hover:bg-yt-red-hover transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch Now
            </a>
            {status !== "watched" && (
              <button
                onClick={() => onStatusChange(video.videoId, "watched")}
                className="px-3 py-1.5 bg-green-600/20 text-green-400 text-xs font-medium rounded-lg hover:bg-green-600/30 transition-colors"
              >
                Mark as Watched
              </button>
            )}
            {status !== "skipped" && (
              <button
                onClick={() => onStatusChange(video.videoId, "skipped")}
                className="px-3 py-1.5 bg-yt-dark-4 text-yt-gray-2 text-xs font-medium rounded-lg hover:bg-yt-dark-4/80 transition-colors"
              >
                Skip
              </button>
            )}
            {status !== "unwatched" && (
              <button
                onClick={() => onStatusChange(video.videoId, "unwatched")}
                className="px-3 py-1.5 bg-yt-dark-4 text-yt-gray-2 text-xs font-medium rounded-lg hover:bg-yt-dark-4/80 transition-colors"
              >
                Reset
              </button>
            )}
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="px-3 py-1.5 bg-yt-dark-4 text-yt-gray-2 text-xs font-medium rounded-lg hover:bg-yt-dark-4/80 transition-colors"
            >
              Notes
            </button>
          </div>

          {/* Notes panel */}
          {showNotes && (
            <div>
              <textarea
                value={progress?.notes || ""}
                onChange={(e) => onNotesChange(video.videoId, e.target.value)}
                placeholder="Take notes while watching..."
                className="w-full bg-yt-dark-3 border border-yt-dark-4 rounded-lg px-3 py-2 text-sm text-white placeholder-yt-gray-3 focus:outline-none focus:border-yt-red resize-y min-h-[80px]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
