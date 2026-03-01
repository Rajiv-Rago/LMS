import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { env } from "@/lib/env";
import { captureException } from "@/lib/logger";
import {
  searchYouTubeVideos,
  filterAndDedup,
} from "@youtube-core/youtubeSearch";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.slice(0, 200);
    const maxResults = Math.min(
      parseInt(searchParams.get("maxResults") || "5", 10),
      10
    );

    if (!query) {
      return NextResponse.json(
        { error: "query parameter is required" },
        { status: 400 }
      );
    }

    const youtubeApiKey = env.YOUTUBE_API_KEY;
    if (!youtubeApiKey) {
      return NextResponse.json(
        { error: "YouTube search is not configured" },
        { status: 503 }
      );
    }

    const rawResults = await searchYouTubeVideos(youtubeApiKey, {
      topic: query,
      maxResults: maxResults * 2,
    });

    const filtered = filterAndDedup(rawResults).slice(0, maxResults);

    const videos = filtered.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channelName: v.channelName,
      channelId: v.channelId,
      thumbnailUrl: v.thumbnailUrl,
      duration: v.duration,
    }));

    return NextResponse.json({ videos });
  } catch (error) {
    captureException(error, { operation: "YouTube search error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
