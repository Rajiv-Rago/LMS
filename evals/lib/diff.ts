import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  CitationEvalResult,
  LessonEvalResult,
  RunMeta,
  SyllabusEvalResult,
  YouTubeEvalResult,
} from "./types";

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf-8");
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

function readMeta(runDir: string): RunMeta | null {
  const path = join(runDir, "meta.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as RunMeta;
}

interface AggregateScores {
  syllabusBinary: Record<string, number>;
  syllabusLikert: Record<string, number>;
  lessonBinary: Record<string, number>;
  lessonLikert: Record<string, number>;
  citationsLive: number;
  citationsDomain: number;
  citationsRelevant: number;
  youtubeLive: number;
  youtubeChannel: number;
  youtubeRelevant: number;
}

function aggregate(runDir: string): {
  meta: RunMeta | null;
  scores: AggregateScores;
} {
  const meta = readMeta(runDir);
  const syllabus = readJsonl<SyllabusEvalResult>(join(runDir, "syllabus-results.jsonl"));
  const lessons = readJsonl<LessonEvalResult>(join(runDir, "lesson-results.jsonl"));
  const citations = readJsonl<CitationEvalResult>(join(runDir, "citations-results.jsonl"));
  const youtube = readJsonl<YouTubeEvalResult>(join(runDir, "youtube-results.jsonl"));

  const scores: AggregateScores = {
    syllabusBinary: aggregateBinary(syllabus),
    syllabusLikert: aggregateLikert(syllabus),
    lessonBinary: aggregateBinary(lessons),
    lessonLikert: aggregateLikert(lessons),
    citationsLive: mean(citations.map((c) => c.aggregates.pctLive)),
    citationsDomain: mean(citations.map((c) => c.aggregates.meanDomainScore)),
    citationsRelevant: mean(citations.map((c) => c.aggregates.pctRelevant)),
    youtubeLive: mean(youtube.map((y) => y.aggregates.pctLive)),
    youtubeChannel: mean(youtube.map((y) => y.aggregates.pctChannelOk)),
    youtubeRelevant: mean(youtube.map((y) => y.aggregates.pctRelevant)),
  };

  return { meta, scores };
}

function aggregateBinary(items: { binary: { name: string; pass: boolean }[] }[]): Record<string, number> {
  const buckets: Record<string, { pass: number; total: number }> = {};
  for (const it of items) {
    for (const b of it.binary) {
      buckets[b.name] ??= { pass: 0, total: 0 };
      buckets[b.name].total += 1;
      if (b.pass) buckets[b.name].pass += 1;
    }
  }
  return Object.fromEntries(
    Object.entries(buckets).map(([k, v]) => [k, v.total > 0 ? v.pass / v.total : 0])
  );
}

function aggregateLikert(items: { likert: { name: string; score: number }[] }[]): Record<string, number> {
  const buckets: Record<string, number[]> = {};
  for (const it of items) {
    for (const l of it.likert) {
      buckets[l.name] ??= [];
      buckets[l.name].push(l.score);
    }
  }
  return Object.fromEntries(
    Object.entries(buckets).map(([k, v]) => [k, mean(v)])
  );
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function fmtDelta(a: number, b: number, unit: "pct" | "raw" = "raw"): string {
  const d = b - a;
  const sign = d > 0 ? "+" : "";
  if (unit === "pct") {
    return `${(a * 100).toFixed(1)}% → ${(b * 100).toFixed(1)}% (${sign}${(d * 100).toFixed(1)}pp)`;
  }
  return `${a.toFixed(2)} → ${b.toFixed(2)} (${sign}${d.toFixed(2)})`;
}

export function diffRuns(runDirA: string, runDirB: string): string {
  const a = aggregate(runDirA);
  const b = aggregate(runDirB);

  const lines: string[] = [];
  lines.push("# Run Diff");
  lines.push("");
  const labelA = a.meta
    ? `${a.meta.runName} (${a.meta.generator.provider}:${a.meta.generator.model ?? "default"})`
    : runDirA;
  const labelB = b.meta
    ? `${b.meta.runName} (${b.meta.generator.provider}:${b.meta.generator.model ?? "default"})`
    : runDirB;
  lines.push(`- A: ${labelA}`);
  lines.push(`- B: ${labelB}`);
  lines.push("");

  const sections: Array<{
    title: string;
    rows: Array<{ name: string; aV: number; bV: number; unit: "pct" | "raw" }>;
  }> = [
    {
      title: "Syllabus — binary pass rates",
      rows: keyUnion(a.scores.syllabusBinary, b.scores.syllabusBinary).map((k) => ({
        name: k,
        aV: a.scores.syllabusBinary[k] ?? 0,
        bV: b.scores.syllabusBinary[k] ?? 0,
        unit: "pct",
      })),
    },
    {
      title: "Syllabus — Likert means",
      rows: keyUnion(a.scores.syllabusLikert, b.scores.syllabusLikert).map((k) => ({
        name: k,
        aV: a.scores.syllabusLikert[k] ?? 0,
        bV: b.scores.syllabusLikert[k] ?? 0,
        unit: "raw",
      })),
    },
    {
      title: "Lesson — binary pass rates",
      rows: keyUnion(a.scores.lessonBinary, b.scores.lessonBinary).map((k) => ({
        name: k,
        aV: a.scores.lessonBinary[k] ?? 0,
        bV: b.scores.lessonBinary[k] ?? 0,
        unit: "pct",
      })),
    },
    {
      title: "Lesson — Likert means",
      rows: keyUnion(a.scores.lessonLikert, b.scores.lessonLikert).map((k) => ({
        name: k,
        aV: a.scores.lessonLikert[k] ?? 0,
        bV: b.scores.lessonLikert[k] ?? 0,
        unit: "raw",
      })),
    },
    {
      title: "Citations",
      rows: [
        { name: "% live", aV: a.scores.citationsLive, bV: b.scores.citationsLive, unit: "pct" },
        { name: "mean domain score", aV: a.scores.citationsDomain, bV: b.scores.citationsDomain, unit: "raw" },
        { name: "% relevant", aV: a.scores.citationsRelevant, bV: b.scores.citationsRelevant, unit: "pct" },
      ],
    },
    {
      title: "YouTube",
      rows: [
        { name: "% live", aV: a.scores.youtubeLive, bV: b.scores.youtubeLive, unit: "pct" },
        { name: "% reputable channel", aV: a.scores.youtubeChannel, bV: b.scores.youtubeChannel, unit: "pct" },
        { name: "% relevant", aV: a.scores.youtubeRelevant, bV: b.scores.youtubeRelevant, unit: "pct" },
      ],
    },
  ];

  for (const section of sections) {
    if (section.rows.length === 0) continue;
    lines.push(`## ${section.title}`);
    lines.push("");
    for (const r of section.rows) {
      lines.push(`- ${r.name}: ${fmtDelta(r.aV, r.bV, r.unit)}`);
    }
    lines.push("");
  }

  if (a.meta && b.meta) {
    lines.push("## Cost");
    lines.push("");
    lines.push(
      `- Generator: $${a.meta.totals.generatorCostUsd.toFixed(4)} → $${b.meta.totals.generatorCostUsd.toFixed(4)}`
    );
    lines.push(
      `- Judge:     $${a.meta.totals.judgeCostUsd.toFixed(4)} → $${b.meta.totals.judgeCostUsd.toFixed(4)}`
    );
  }

  return lines.join("\n");
}

function keyUnion(a: Record<string, number>, b: Record<string, number>): string[] {
  return Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
}
