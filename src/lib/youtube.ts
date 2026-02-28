import { YouTubeVideo } from "./types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function parseDuration(iso8601: string): number {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface SearchOptions {
  topic: string;
  maxResults?: number;
  videoDuration?: "short" | "medium" | "long" | "any";
  order?: "relevance" | "viewCount" | "date" | "rating";
  publishedAfter?: string;
}

export async function searchVideos(
  apiKey: string,
  options: SearchOptions
): Promise<YouTubeVideo[]> {
  const { topic, maxResults = 50, order = "relevance", publishedAfter } = options;

  const searchQueries = [
    `${topic} tutorial`,
    `learn ${topic} beginner to advanced`,
    `${topic} full course`,
    `${topic} explained`,
  ];

  const allVideoIds: Set<string> = new Set();

  // Run all search queries in parallel
  const searchResults = await Promise.all(
    searchQueries.map(async (query) => {
      const params = new URLSearchParams({
        part: "snippet",
        q: query,
        type: "video",
        maxResults: String(Math.ceil(maxResults / searchQueries.length)),
        order,
        key: apiKey,
        videoEmbeddable: "true",
        relevanceLanguage: "en",
      });

      if (publishedAfter) {
        params.set("publishedAfter", publishedAfter);
      }

      const res = await fetch(`${YOUTUBE_API_BASE}/search?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(`YouTube search failed: ${err.error?.message || res.statusText}`);
      }

      return res.json();
    })
  );

  // Deduplicate video IDs across all search results
  const allIds: string[] = [];
  for (const data of searchResults) {
    for (const item of data.items || []) {
      const id = item.id?.videoId;
      if (id && !allVideoIds.has(id)) {
        allVideoIds.add(id);
        allIds.push(id);
      }
    }
  }
  if (allIds.length === 0) return [];

  // Fetch details in batches of 50
  const videos: YouTubeVideo[] = [];
  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      id: batch.join(","),
      key: apiKey,
    });

    const res = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);
    if (!res.ok) continue;

    const data = await res.json();
    for (const item of data.items || []) {
      const durationSeconds = parseDuration(item.contentDetails?.duration || "PT0S");
      // Skip very short videos (< 2 min, likely intros/trailers)
      if (durationSeconds < 120) continue;

      videos.push({
        videoId: item.id,
        title: item.snippet?.title || "",
        channelName: item.snippet?.channelTitle || "",
        channelId: item.snippet?.channelId || "",
        description: (item.snippet?.description || "").slice(0, 500),
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          "",
        viewCount: parseInt(item.statistics?.viewCount || "0"),
        likeCount: parseInt(item.statistics?.likeCount || "0"),
        commentCount: parseInt(item.statistics?.commentCount || "0"),
        duration: formatDuration(durationSeconds),
        durationSeconds,
        publishedAt: item.snippet?.publishedAt || "",
        tags: item.snippet?.tags || [],
      });
    }
  }

  return videos;
}
