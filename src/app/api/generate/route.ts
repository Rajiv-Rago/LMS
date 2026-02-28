import { NextRequest, NextResponse } from "next/server";
import { searchVideos } from "@/lib/youtube";
import { generateLearningPath } from "@/lib/groq";
import { PathFormData } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const formData: PathFormData = await request.json();

    // Validate required fields
    if (!formData.topic?.trim()) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    const youtubeKey = process.env.YOUTUBE_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (!youtubeKey) {
      return NextResponse.json(
        { error: "YouTube API key not configured. Add YOUTUBE_API_KEY to .env.local" },
        { status: 500 }
      );
    }
    if (!groqKey) {
      return NextResponse.json(
        { error: "Groq API key not configured. Add GROQ_API_KEY to .env.local" },
        { status: 500 }
      );
    }

    // Calculate publishedAfter based on exclude filters
    let publishedAfter: string | undefined;
    if (formData.excludeFilters.includes("outdated")) {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      publishedAfter = twoYearsAgo.toISOString();
    }

    // Search YouTube
    const videos = await searchVideos(youtubeKey, {
      topic: formData.topic,
      maxResults: 60,
      publishedAfter,
    });

    if (videos.length === 0) {
      return NextResponse.json(
        { error: `No YouTube videos found for "${formData.topic}". Try a broader topic.` },
        { status: 404 }
      );
    }

    // Generate learning path with AI
    const path = await generateLearningPath(groqKey, formData, videos);

    return NextResponse.json(path);
  } catch (error) {
    console.error("Generate path error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
