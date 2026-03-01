"use client";

import { useState } from "react";

interface VideoResult {
  videoId: string;
  title: string;
  channelName: string;
  channelId: string;
  thumbnailUrl: string;
  duration: string;
}

interface YouTubeVideoPickerProps {
  defaultQuery: string;
  onSelect: (video: VideoResult) => void;
  onCancel: () => void;
}

export default function YouTubeVideoPicker({
  defaultQuery,
  onSelect,
  onCancel,
}: YouTubeVideoPickerProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setError("");

    try {
      const res = await fetch(
        `/api/youtube/search?query=${encodeURIComponent(query)}&maxResults=6`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Search failed");
        return;
      }

      setVideos(data.videos || []);
      setSearched(true);
    } catch {
      setError("Failed to search YouTube");
    } finally {
      setSearching(false);
    }
  };

  // Format ISO 8601 duration (PT1H2M3S) to human-readable
  const formatDuration = (iso: string) => {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return iso;
    const h = match[1] ? `${match[1]}:` : "";
    const m = match[2] || "0";
    const s = (match[3] || "0").padStart(2, "0");
    return h ? `${h}${m.padStart(2, "0")}:${s}` : `${m}:${s}`;
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search YouTube..."
          className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {searching ? "Searching..." : "Search"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
        >
          Cancel
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {searched && videos.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No videos found. Try a different search term.
        </p>
      )}

      {videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {videos.map((video) => (
            <button
              key={video.videoId}
              onClick={() => onSelect(video)}
              className="flex gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className="w-32 h-20 object-cover rounded flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-white line-clamp-2">
                  {video.title}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {video.channelName}
                </p>
                {video.duration && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {formatDuration(video.duration)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
