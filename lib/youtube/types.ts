export interface YouTubePathFormData {
  topic: string;
  skillLevel: "complete_beginner" | "some_basics" | "intermediate" | "advanced";
  teachingStyle?: string;
  videoLengthPreference?: "short" | "medium" | "long" | "any";
  pathVariant?: "fast_track" | "standard" | "deep_dive";
}

export interface GeneratedYouTubeVideo {
  videoId: string;
  title: string;
  channelName: string;
  channelId: string;
  thumbnailUrl: string;
  viewCount: number;
  publishedAt: string;
  duration: string;
  durationSeconds: number;
  whyIncluded: string;
  keyTakeaways: string[];
}

export interface GeneratedPracticeProject {
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedHours: number;
}

export interface GeneratedYouTubeModule {
  title: string;
  description: string;
  order: number;
  videos: GeneratedYouTubeVideo[];
  practiceProject?: GeneratedPracticeProject;
}

export interface GeneratedYouTubePath {
  courseTitle: string;
  courseDescription: string;
  modules: GeneratedYouTubeModule[];
}
