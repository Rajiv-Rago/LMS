import { searchYouTubeVideos, filterAndDedup } from "@youtube-core/youtubeSearch";
import { createAIProvider } from "@/lib/ai";
import { AIProviderName } from "@/lib/ai/types";
import { buildYouTubePathPrompt } from "./youtubePathPrompt";
import type { YouTubePathFormData, GeneratedYouTubePath } from "./types";

interface YouTubePathServiceConfig {
  provider: AIProviderName;
  apiKey: string;
  model?: string;
  youtubeApiKey: string;
}

export class YouTubePathService {
  private config: YouTubePathServiceConfig;

  constructor(config: YouTubePathServiceConfig) {
    this.config = config;
  }

  async generatePath(form: YouTubePathFormData): Promise<GeneratedYouTubePath> {
    // 1. Search YouTube
    const rawVideos = await searchYouTubeVideos(this.config.youtubeApiKey, {
      topic: form.topic,
      maxResults: 50,
      order: "relevance",
    });

    // 2. Dedup and filter
    const videos = filterAndDedup(rawVideos);

    if (videos.length === 0) {
      throw new Error(`No YouTube videos found for topic: ${form.topic}`);
    }

    // 3. Build prompt with video data
    const videoListJson = JSON.stringify(
      videos.map((v) => ({
        videoId: v.videoId,
        title: v.title,
        channelName: v.channelName,
        channelId: v.channelId,
        thumbnailUrl: v.thumbnailUrl,
        viewCount: v.viewCount,
        publishedAt: v.publishedAt,
        duration: v.duration,
        durationSeconds: v.durationSeconds,
        description: v.description.slice(0, 200),
      }))
    );

    const prompt = buildYouTubePathPrompt(form, videoListJson);

    // 4. Call LLM via Kantigo's provider system
    const aiProvider = createAIProvider({
      provider: this.config.provider,
      apiKey: this.config.apiKey,
      model: this.config.model,
    });

    const response = await aiProvider.generateText(prompt);

    // 5. Parse structured JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse LLM response as JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeneratedYouTubePath;

    if (!parsed.courseTitle || !parsed.modules?.length) {
      throw new Error("LLM returned invalid path structure");
    }

    return parsed;
  }
}
