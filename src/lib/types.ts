// ─── Form Input Types ───

export type SkillLevel =
  | "complete_beginner"
  | "some_basics"
  | "intermediate"
  | "advanced";

export type VideoLength = "short" | "medium" | "long" | "any";

export type TeachingStyle =
  | "straight_to_point"
  | "detailed"
  | "project_based"
  | "theory_focused"
  | "visual_animated"
  | "code_along";

export type CreatorType =
  | "professional"
  | "self_taught"
  | "university"
  | "any_credible";

export type HoursPerWeek = "2-3" | "3-5" | "5-10" | "10+";

export type Timeline =
  | "1_week"
  | "2_weeks"
  | "1_month"
  | "2-3_months"
  | "no_rush";

export type ExcludeFilter =
  | "outdated"
  | "clickbait"
  | "low_quality"
  | "non_english";

export type IncludeFilter =
  | "exercises"
  | "projects"
  | "quizzes"
  | "resources";

export interface PathFormData {
  topic: string;
  skillLevel: SkillLevel;
  learningGoal: string;
  videoLengths: VideoLength[];
  teachingStyles: TeachingStyle[];
  creatorTypes: CreatorType[];
  hoursPerWeek: HoursPerWeek;
  timeline: Timeline;
  excludeFilters: ExcludeFilter[];
  includeFilters: IncludeFilter[];
}

// ─── YouTube API Types ───

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelName: string;
  channelId: string;
  description: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string; // ISO 8601
  durationSeconds: number;
  publishedAt: string;
  tags: string[];
}

// ─── AI-Generated Learning Path Types ───

export interface PathVideo {
  videoId: string;
  title: string;
  channelName: string;
  duration: string;
  durationSeconds: number;
  thumbnailUrl: string;
  viewCount: number;
  whyIncluded: string;
  keyTakeaways: string[];
  prerequisites: string[];
  practiceSuggestion: string;
}

export interface ModuleCheck {
  description: string;
  items: string[];
}

export interface LearningModule {
  id: string;
  number: number;
  name: string;
  description: string;
  estimatedHours: number;
  estimatedWeeks: number;
  videos: PathVideo[];
  moduleCheck: ModuleCheck;
  practiceProject?: PracticeProject;
}

export interface PracticeProject {
  title: string;
  description: string;
  whyThisProject: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedHours: number;
  tutorialVideoId?: string;
}

export interface PathVariant {
  name: "fast_track" | "standard" | "deep_dive";
  label: string;
  description: string;
  totalVideos: number;
  totalHours: number;
  moduleIds: string[];
}

export interface WeekSchedule {
  week: number;
  videoIds: string[];
  totalHours: number;
}

export interface SupplementaryResource {
  title: string;
  url: string;
  type: "documentation" | "platform" | "community" | "cheatsheet" | "reading";
  description: string;
}

export interface LearningPath {
  id: string;
  createdAt: string;
  formData: PathFormData;
  summary: {
    topic: string;
    totalVideos: number;
    totalVideoHours: number;
    totalPracticeHours: number;
    totalHours: number;
    completionWeeks: number;
    startDate: string;
    finishDate: string;
  };
  modules: LearningModule[];
  variants: PathVariant[];
  schedule: WeekSchedule[];
  supplementaryResources: SupplementaryResource[];
}

// ─── Progress Tracking Types ───

export interface VideoProgress {
  videoId: string;
  status: "unwatched" | "watching" | "watched" | "skipped";
  watchedAt?: string;
  notes: string;
  timestamps: { time: string; note: string }[];
}

export interface PathProgress {
  pathId: string;
  activeVariant: "fast_track" | "standard" | "deep_dive";
  videoProgress: Record<string, VideoProgress>;
  moduleChecks: Record<string, boolean[]>;
  projectsCompleted: string[];
  startedAt: string;
  lastActivityAt: string;
  streakDays: number;
  lastStreakDate: string;
}

// ─── Stored Data ───

export interface StoredData {
  paths: Record<string, LearningPath>;
  progress: Record<string, PathProgress>;
}
