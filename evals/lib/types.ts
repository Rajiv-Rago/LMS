import type { GeneratedSyllabus } from "@/lib/ai/services/syllabusGenerator";
import type { GeneratedLessonContent } from "@/lib/ai/services/lessonContentGenerator";
import type { AISource, AIProviderName } from "@/lib/ai/types";
import type { GeneratedYouTubePath } from "@/lib/youtube/types";

export type RubricName = "syllabus" | "lesson" | "citations" | "youtube";

export type Domain = "technical" | "stem" | "humanities" | "practical";

export type TargetLevel = "beginner" | "intermediate" | "advanced";

export interface TopicEntry {
  id: string;
  topic: string;
  targetLevel: TargetLevel;
  estimatedDuration: string;
  domain: Domain;
  mustCoverTopics: string[];
}

export interface TopicsDataset {
  version: string;
  topics: TopicEntry[];
}

export interface GeneratorSpec {
  provider: AIProviderName;
  model?: string;
}

export interface UsageRecord {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostRecord {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptUsd: number;
  completionUsd: number;
  totalUsd: number;
}

export interface JudgeCall {
  model: string;
  usage?: UsageRecord;
  cost?: CostRecord;
  latencyMs?: number;
}

export interface BinaryScore {
  name: string;
  pass: boolean;
  reason?: string;
}

export interface LikertScore {
  name: string;
  score: number; // 1..5
  reason?: string;
}

export interface SyllabusEvalResult {
  topicId: string;
  topic: string;
  targetLevel: TargetLevel;
  domain: Domain;
  generator: GeneratorSpec;
  rubricVersion: string;
  generated: GeneratedSyllabus | null;
  generationError?: string;
  generationLatencyMs?: number;
  generationUsage?: UsageRecord;
  generationCost?: CostRecord;
  binary: BinaryScore[];
  likert: LikertScore[];
  judgeCalls: JudgeCall[];
}

export interface LessonEvalResult {
  topicId: string;
  topic: string;
  moduleTitle: string;
  lessonTitle: string;
  lessonOutline: string;
  position: "first" | "last";
  generator: GeneratorSpec;
  rubricVersion: string;
  generated: GeneratedLessonContent | null;
  generationError?: string;
  generationLatencyMs?: number;
  generationUsage?: UsageRecord;
  generationCost?: CostRecord;
  binary: BinaryScore[];
  likert: LikertScore[];
  judgeCalls: JudgeCall[];
}

export interface CitationCheck {
  url: string;
  title: string;
  live: boolean | "unknown";
  status?: number | string;
  domainScore: 0 | 1 | 2;
  domainCategory: "official" | "established" | "other";
  relevant: boolean | "unknown";
  relevanceReason?: string;
  fetchError?: string;
}

export interface CitationEvalResult {
  topicId: string;
  lessonTitle: string;
  rubricVersion: string;
  generator: GeneratorSpec;
  sources: CitationCheck[];
  aggregates: {
    total: number;
    pctLive: number;
    meanDomainScore: number;
    pctRelevant: number;
  };
  judgeCalls: JudgeCall[];
}

export interface YouTubeVideoCheck {
  videoId: string;
  title: string;
  channelName: string;
  url: string;
  live: boolean | "unknown";
  channelOk: boolean | "unknown";
  channelReason?: string;
  relevant: boolean | "unknown";
  relevanceReason?: string;
  fetchError?: string;
}

export interface YouTubeEvalResult {
  topicId: string;
  topic: string;
  targetLevel: TargetLevel;
  rubricVersion: string;
  generator: GeneratorSpec;
  generatedPath: GeneratedYouTubePath | null;
  generationError?: string;
  generationLatencyMs?: number;
  videos: YouTubeVideoCheck[];
  aggregates: {
    total: number;
    pctLive: number;
    pctChannelOk: number;
    pctRelevant: number;
  };
  judgeCalls: JudgeCall[];
}

export interface RunMeta {
  runName: string;
  startedAt: string;
  finishedAt?: string;
  generator: GeneratorSpec;
  judgeModels: {
    rubric: string;
    bounded: string;
  };
  topicsDataset: string;
  rubricVersions: Record<RubricName, string>;
  limit?: number;
  includeYouTube: boolean;
  dryRun: boolean;
  totals: {
    syllabusEvals: number;
    lessonEvals: number;
    citationEvals: number;
    youtubeEvals: number;
    judgeCalls: number;
    judgeTokens: number;
    judgeCostUsd: number;
    generatorTokens: number;
    generatorCostUsd: number;
  };
}

export interface CalibrationLabel {
  exampleId: string;
  rubric: RubricName;
  binary?: Record<string, boolean>;
  likert?: Record<string, number>;
  notes?: string;
}

export type AnySource = AISource;
