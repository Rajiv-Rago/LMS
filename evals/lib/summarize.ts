import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatUsd } from "./cost";
import type {
  CitationEvalResult,
  LessonEvalResult,
  RunMeta,
  SyllabusEvalResult,
  YouTubeEvalResult,
} from "./types";

interface SummarizeInput {
  runDir: string;
  meta: RunMeta;
  syllabus: SyllabusEvalResult[];
  lessons: LessonEvalResult[];
  citations: CitationEvalResult[];
  youtube: YouTubeEvalResult[];
  calibrationGaps?: string[];
}

function meanArr(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function summarizeBinary(results: { binary: { name: string; pass: boolean }[] }[]): string[] {
  const buckets: Record<string, { pass: number; total: number }> = {};
  for (const r of results) {
    for (const b of r.binary) {
      buckets[b.name] ??= { pass: 0, total: 0 };
      buckets[b.name].total += 1;
      if (b.pass) buckets[b.name].pass += 1;
    }
  }
  return Object.entries(buckets).map(
    ([name, { pass, total }]) =>
      `- ${name}: ${pass}/${total} pass (${pct(total > 0 ? pass / total : 0)})`
  );
}

function summarizeLikert(results: { likert: { name: string; score: number }[] }[]): string[] {
  const buckets: Record<string, number[]> = {};
  for (const r of results) {
    for (const l of r.likert) {
      buckets[l.name] ??= [];
      buckets[l.name].push(l.score);
    }
  }
  return Object.entries(buckets).map(
    ([name, scores]) => `- ${name}: mean ${meanArr(scores).toFixed(2)} (n=${scores.length})`
  );
}

export function writeSummary(input: SummarizeInput): string {
  const { meta, syllabus, lessons, citations, youtube } = input;

  const lines: string[] = [];
  lines.push(`# Run: ${meta.runName}`);
  lines.push("");
  lines.push(
    `- Generator: \`${meta.generator.provider}:${meta.generator.model ?? "default"}\``
  );
  lines.push(`- Judge rubric model: \`${meta.judgeModels.rubric}\``);
  lines.push(`- Judge bounded model: \`${meta.judgeModels.bounded}\``);
  lines.push(`- Topics dataset: \`${meta.topicsDataset}\``);
  lines.push(`- Started: ${meta.startedAt}`);
  if (meta.finishedAt) lines.push(`- Finished: ${meta.finishedAt}`);
  lines.push(`- Rubric versions: ${JSON.stringify(meta.rubricVersions)}`);
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`- Syllabus evals: ${meta.totals.syllabusEvals}`);
  lines.push(`- Lesson evals: ${meta.totals.lessonEvals}`);
  lines.push(`- Citation evals: ${meta.totals.citationEvals}`);
  lines.push(`- YouTube evals: ${meta.totals.youtubeEvals}`);
  lines.push(
    `- Judge calls: ${meta.totals.judgeCalls} (${meta.totals.judgeTokens} tokens, ${formatUsd(meta.totals.judgeCostUsd)})`
  );
  lines.push(
    `- Generator usage: ${meta.totals.generatorTokens} tokens (${formatUsd(meta.totals.generatorCostUsd)})`
  );
  lines.push("");

  if (input.calibrationGaps?.length) {
    lines.push("## Calibration gaps");
    lines.push("");
    lines.push("Dimensions below kappa threshold (uncalibrated):");
    for (const g of input.calibrationGaps) lines.push(`- ${g}`);
    lines.push("");
  }

  if (syllabus.length > 0) {
    lines.push("## Syllabus");
    lines.push("");
    const failures = syllabus.filter((s) => !!s.generationError);
    lines.push(`- Generation failures: ${failures.length}/${syllabus.length}`);
    const latencies = syllabus
      .filter((s) => typeof s.generationLatencyMs === "number")
      .map((s) => s.generationLatencyMs ?? 0)
      .sort((a, b) => a - b);
    const median = latencies.length > 0 ? latencies[Math.floor(latencies.length / 2)] : 0;
    lines.push(`- Median generation latency: ${median} ms`);
    lines.push("");
    lines.push("### Binary checks");
    for (const l of summarizeBinary(syllabus)) lines.push(l);
    lines.push("");
    lines.push("### Likert dimensions");
    for (const l of summarizeLikert(syllabus)) lines.push(l);
    lines.push("");
    if (failures.length) {
      lines.push("### Failures");
      for (const f of failures) {
        lines.push(`- ${f.topicId}: ${f.generationError}`);
      }
      lines.push("");
    }
  }

  if (lessons.length > 0) {
    lines.push("## Lessons");
    lines.push("");
    const failures = lessons.filter((l) => !!l.generationError);
    lines.push(`- Generation failures: ${failures.length}/${lessons.length}`);
    lines.push("");
    lines.push("### Binary checks");
    for (const l of summarizeBinary(lessons)) lines.push(l);
    lines.push("");
    lines.push("### Likert dimensions");
    for (const l of summarizeLikert(lessons)) lines.push(l);
    lines.push("");
    if (failures.length) {
      lines.push("### Failures");
      for (const f of failures) {
        lines.push(`- ${f.topicId} / ${f.lessonTitle}: ${f.generationError}`);
      }
      lines.push("");
    }
  }

  if (citations.length > 0) {
    lines.push("## Citations");
    lines.push("");
    const pctLive = meanArr(citations.map((c) => c.aggregates.pctLive));
    const meanDomain = meanArr(citations.map((c) => c.aggregates.meanDomainScore));
    const pctRelevant = meanArr(citations.map((c) => c.aggregates.pctRelevant));
    lines.push(`- Mean % live URLs: ${pct(pctLive)}`);
    lines.push(`- Mean domain score (0..2): ${meanDomain.toFixed(2)}`);
    lines.push(`- Mean % topically relevant: ${pct(pctRelevant)}`);
    const deadUrls = citations
      .flatMap((c) => c.sources.filter((s) => s.live === false).map((s) => s.url))
      .slice(0, 10);
    if (deadUrls.length) {
      lines.push("");
      lines.push("### Sample dead URLs");
      for (const u of deadUrls) lines.push(`- ${u}`);
    }
    lines.push("");
  }

  if (youtube.length > 0) {
    lines.push("## YouTube");
    lines.push("");
    const failures = youtube.filter((y) => !!y.generationError);
    lines.push(`- Generation failures: ${failures.length}/${youtube.length}`);
    const pctLive = meanArr(youtube.map((y) => y.aggregates.pctLive));
    const pctChan = meanArr(youtube.map((y) => y.aggregates.pctChannelOk));
    const pctRel = meanArr(youtube.map((y) => y.aggregates.pctRelevant));
    lines.push(`- Mean % live videos: ${pct(pctLive)}`);
    lines.push(`- Mean % reputable channel: ${pct(pctChan)}`);
    lines.push(`- Mean % topically relevant: ${pct(pctRel)}`);
    lines.push("");
    if (failures.length) {
      lines.push("### Generation failures");
      for (const f of failures) lines.push(`- ${f.topicId}: ${f.generationError}`);
      lines.push("");
    }
  }

  const out = lines.join("\n");
  writeFileSync(join(input.runDir, "summary.md"), out, "utf-8");
  return out;
}
