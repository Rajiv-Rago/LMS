import { judgeJson } from "./judge";
import type {
  GeneratorSpec,
  JudgeCall,
  TargetLevel,
  YouTubeEvalResult,
  YouTubeVideoCheck,
} from "./types";
import type { GeneratedYouTubePath } from "@/lib/youtube/types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MIN_SUBSCRIBERS = 1000;
const MIN_VIDEOS = 5;
const MIN_CHANNEL_AGE_DAYS = 180;

interface ChannelInfo {
  subscriberCount: number;
  videoCount: number;
  publishedAt: string;
}

async function fetchChannelInfo(
  channelIds: string[],
  apiKey: string
): Promise<Map<string, ChannelInfo>> {
  const result = new Map<string, ChannelInfo>();
  if (channelIds.length === 0) return result;

  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: "snippet,statistics",
      id: batch.join(","),
      key: apiKey,
    });
    const res = await fetch(`${YOUTUBE_API_BASE}/channels?${params}`);
    if (!res.ok) continue;
    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        snippet?: { publishedAt?: string };
        statistics?: { subscriberCount?: string; videoCount?: string };
      }>;
    };
    for (const item of data.items ?? []) {
      result.set(item.id, {
        subscriberCount: parseInt(item.statistics?.subscriberCount ?? "0", 10),
        videoCount: parseInt(item.statistics?.videoCount ?? "0", 10),
        publishedAt: item.snippet?.publishedAt ?? "",
      });
    }
  }
  return result;
}

async function fetchVideoLiveness(
  videoIds: string[],
  apiKey: string
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (videoIds.length === 0) return result;

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: "status",
      id: batch.join(","),
      key: apiKey,
    });
    const res = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);
    if (!res.ok) {
      for (const id of batch) result.set(id, false);
      continue;
    }
    const data = (await res.json()) as {
      items?: Array<{ id: string; status?: { privacyStatus?: string } }>;
    };
    const seen = new Set<string>();
    for (const item of data.items ?? []) {
      seen.add(item.id);
      result.set(item.id, item.status?.privacyStatus === "public");
    }
    for (const id of batch) {
      if (!seen.has(id)) result.set(id, false);
    }
  }
  return result;
}

function assessChannel(info: ChannelInfo | undefined): {
  ok: boolean;
  reason: string;
} {
  if (!info) return { ok: false, reason: "channel-info-missing" };
  if (info.subscriberCount < MIN_SUBSCRIBERS) {
    return { ok: false, reason: `subscribers<${MIN_SUBSCRIBERS}` };
  }
  if (info.videoCount < MIN_VIDEOS) {
    return { ok: false, reason: `videos<${MIN_VIDEOS}` };
  }
  if (info.publishedAt) {
    const ageDays = (Date.now() - new Date(info.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < MIN_CHANNEL_AGE_DAYS) {
      return { ok: false, reason: `channel-age<${MIN_CHANNEL_AGE_DAYS}d` };
    }
  }
  return { ok: true, reason: "ok" };
}

interface RelevanceVerdict {
  relevant: boolean;
  reason: string;
}

async function judgeVideoRelevance(args: {
  topic: string;
  targetLevel: TargetLevel;
  videoTitle: string;
  channelName: string;
  whyIncluded?: string;
}): Promise<{ result: RelevanceVerdict; call: JudgeCall }> {
  const prompt = `You are evaluating whether a YouTube video is appropriate for a learning module.

Topic: "${args.topic}"
Target level: ${args.targetLevel}

Video title: "${args.videoTitle}"
Channel: ${args.channelName}
${args.whyIncluded ? `Curator note: ${args.whyIncluded}` : ""}

Question: Does this video plausibly teach the topic at the target level?

Reply with strict JSON only:
{ "relevant": true|false, "reason": "<one short sentence>" }`;

  const { parsed, call } = await judgeJson<RelevanceVerdict>("bounded", prompt, {
    maxTokens: 200,
  });
  return {
    result: {
      relevant: Boolean(parsed.relevant),
      reason: String(parsed.reason ?? ""),
    },
    call,
  };
}

export interface EvalYouTubeOptions {
  topicId: string;
  topic: string;
  targetLevel: TargetLevel;
  generator: GeneratorSpec;
  rubricVersion: string;
  generatedPath: GeneratedYouTubePath | null;
  generationError?: string;
  generationLatencyMs?: number;
  youtubeApiKey?: string;
  skipJudge?: boolean;
}

export async function evalYouTubePath(opts: EvalYouTubeOptions): Promise<YouTubeEvalResult> {
  const judgeCalls: JudgeCall[] = [];
  const videoChecks: YouTubeVideoCheck[] = [];

  const allVideos = (opts.generatedPath?.modules ?? []).flatMap((m) =>
    m.videos.map((v) => ({ ...v, _module: m.title }))
  );

  let livenessMap = new Map<string, boolean>();
  let channelMap = new Map<string, ChannelInfo>();

  if (opts.youtubeApiKey && allVideos.length > 0) {
    const videoIds = Array.from(new Set(allVideos.map((v) => v.videoId).filter(Boolean)));
    const channelIds = Array.from(new Set(allVideos.map((v) => v.channelId).filter(Boolean)));
    try {
      livenessMap = await fetchVideoLiveness(videoIds, opts.youtubeApiKey);
    } catch {
      livenessMap = new Map();
    }
    try {
      channelMap = await fetchChannelInfo(channelIds, opts.youtubeApiKey);
    } catch {
      channelMap = new Map();
    }
  }

  for (const v of allVideos) {
    const url = `https://www.youtube.com/watch?v=${v.videoId}`;
    const liveResult = opts.youtubeApiKey ? livenessMap.get(v.videoId) ?? false : "unknown";
    const channelInfo = channelMap.get(v.channelId);
    const channelAssessment = opts.youtubeApiKey
      ? assessChannel(channelInfo)
      : { ok: "unknown" as const, reason: "no-api-key" };

    let relevant: boolean | "unknown" = "unknown";
    let relevanceReason: string | undefined;

    if (!opts.skipJudge) {
      try {
        const { result, call } = await judgeVideoRelevance({
          topic: opts.topic,
          targetLevel: opts.targetLevel,
          videoTitle: v.title,
          channelName: v.channelName,
          whyIncluded: v.whyIncluded,
        });
        relevant = result.relevant;
        relevanceReason = result.reason;
        judgeCalls.push(call);
      } catch (err) {
        relevanceReason = `judge-error: ${(err as Error).message}`;
      }
    }

    videoChecks.push({
      videoId: v.videoId,
      title: v.title,
      channelName: v.channelName,
      url,
      live: liveResult,
      channelOk: channelAssessment.ok,
      channelReason: channelAssessment.reason,
      relevant,
      relevanceReason,
    });
  }

  const total = videoChecks.length;
  const liveDen = videoChecks.filter((v) => v.live !== "unknown").length;
  const liveCount = videoChecks.filter((v) => v.live === true).length;
  const chanDen = videoChecks.filter((v) => v.channelOk !== "unknown").length;
  const chanCount = videoChecks.filter((v) => v.channelOk === true).length;
  const relDen = videoChecks.filter((v) => v.relevant !== "unknown").length;
  const relCount = videoChecks.filter((v) => v.relevant === true).length;

  return {
    topicId: opts.topicId,
    topic: opts.topic,
    targetLevel: opts.targetLevel,
    rubricVersion: opts.rubricVersion,
    generator: opts.generator,
    generatedPath: opts.generatedPath,
    generationError: opts.generationError,
    generationLatencyMs: opts.generationLatencyMs,
    videos: videoChecks,
    aggregates: {
      total,
      pctLive: liveDen > 0 ? liveCount / liveDen : 0,
      pctChannelOk: chanDen > 0 ? chanCount / chanDen : 0,
      pctRelevant: relDen > 0 ? relCount / relDen : 0,
    },
    judgeCalls,
  };
}
