import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SyllabusGeneratorService,
  type GeneratedSyllabus,
} from "@/lib/ai/services/syllabusGenerator";
import {
  LessonContentGeneratorService,
  type GeneratedLessonContent,
} from "@/lib/ai/services/lessonContentGenerator";
import { YouTubePathService } from "@/lib/youtube/youtubePathService";
import { getApiKey } from "@/lib/ai/utils/apiKeys";
import type { AIProviderName } from "@/lib/ai/types";
import { computeCost } from "./cost";
import { loadDataset } from "./dataset";
import { sampleFirstAndLast } from "./sampler";
import { evalCitations } from "./citations";
import { evalYouTubePath } from "./youtube";
import { judgeJson, JUDGE_MODELS } from "./judge";
import { writeSummary } from "./summarize";
import type {
  BinaryScore,
  CitationEvalResult,
  GeneratorSpec,
  JudgeCall,
  LessonEvalResult,
  LikertScore,
  RubricName,
  RunMeta,
  SyllabusEvalResult,
  TopicEntry,
  YouTubeEvalResult,
} from "./types";

export const RUBRIC_VERSIONS: Record<RubricName, string> = {
  syllabus: "v1",
  lesson: "v1",
  citations: "v1",
  youtube: "v1",
};

export interface RunOptions {
  generator: GeneratorSpec;
  topicsPath: string;
  runName?: string;
  limit?: number;
  includeYouTube?: boolean;
  dryRun?: boolean;
  outputRoot?: string;
}

interface RunPaths {
  runDir: string;
  syllabusPath: string;
  lessonPath: string;
  citationsPath: string;
  youtubePath: string;
  metaPath: string;
}

function preparePaths(runName: string, outputRoot: string): RunPaths {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dirName = `${ts}-${runName}`;
  const runDir = resolve(outputRoot, dirName);
  mkdirSync(runDir, { recursive: true });
  return {
    runDir,
    syllabusPath: join(runDir, "syllabus-results.jsonl"),
    lessonPath: join(runDir, "lesson-results.jsonl"),
    citationsPath: join(runDir, "citations-results.jsonl"),
    youtubePath: join(runDir, "youtube-results.jsonl"),
    metaPath: join(runDir, "meta.json"),
  };
}

function appendJsonl(path: string, record: unknown): void {
  appendFileSync(path, `${JSON.stringify(record)}\n`, "utf-8");
}

function resolveApiKey(provider: AIProviderName): string {
  const key = getApiKey(provider);
  if (!key) {
    throw new Error(
      `API key for provider "${provider}" not configured (env: ${provider.toUpperCase()}_API_KEY)`
    );
  }
  return key;
}

interface SyllabusJudgement {
  coverage: { score: number; reason: string };
  progression: { score: number; reason: string };
  levelAppropriateness: { score: number; reason: string };
}

async function judgeSyllabus(
  topic: TopicEntry,
  syllabus: GeneratedSyllabus
): Promise<{ judgement: SyllabusJudgement; call: JudgeCall }> {
  const prompt = `You are a curriculum quality auditor. Score the following syllabus on three dimensions using a 1-5 Likert scale (1=poor, 5=excellent).

Topic: "${topic.topic}"
Target level: ${topic.targetLevel}
Estimated duration: ${topic.estimatedDuration}
Must-cover topics: ${topic.mustCoverTopics.join("; ")}

Syllabus (JSON):
${JSON.stringify(syllabus, null, 2).slice(0, 8000)}

Scoring anchors:
- Coverage (does the syllabus hit the must-cover topics?):
  1 = misses most; 3 = hits roughly half; 5 = hits all clearly
- Progression (do later modules build on earlier ones?):
  1 = jumbled; 3 = mostly linear with some breaks; 5 = clear pedagogical progression
- Level-appropriateness (matches the target level?):
  1 = grossly mismatched; 3 = mostly aligned; 5 = perfectly calibrated to ${topic.targetLevel}

Reply with strict JSON only:
{
  "coverage": { "score": 1-5, "reason": "<short>" },
  "progression": { "score": 1-5, "reason": "<short>" },
  "levelAppropriateness": { "score": 1-5, "reason": "<short>" }
}`;

  const { parsed, call } = await judgeJson<SyllabusJudgement>("rubric", prompt, {
    maxTokens: 600,
  });
  return { judgement: parsed, call };
}

function checkSyllabusBinaries(
  topic: TopicEntry,
  syllabus: GeneratedSyllabus
): BinaryScore[] {
  const out: BinaryScore[] = [];

  const allModules = syllabus.modules ?? [];
  const moduleHasLesson = allModules.every((m) => (m.lessons ?? []).length > 0);
  out.push({
    name: "every_module_has_lesson",
    pass: moduleHasLesson,
    reason: moduleHasLesson ? undefined : "one or more modules have zero lessons",
  });

  const moduleTitles = allModules.map((m) => m.title.trim().toLowerCase());
  const dupModules = moduleTitles.filter((t, i) => moduleTitles.indexOf(t) !== i);
  const lessonTitles = allModules
    .flatMap((m) => m.lessons ?? [])
    .map((l) => l.title.trim().toLowerCase());
  const dupLessons = lessonTitles.filter((t, i) => lessonTitles.indexOf(t) !== i);
  const noDupes = dupModules.length === 0 && dupLessons.length === 0;
  out.push({
    name: "no_duplicate_titles",
    pass: noDupes,
    reason: noDupes
      ? undefined
      : `dup modules: ${dupModules.join(", ")}; dup lessons: ${dupLessons.join(", ")}`,
  });

  const totalLessons = allModules.reduce((sum, m) => sum + (m.lessons?.length ?? 0), 0);
  const durationMatch = topic.estimatedDuration.match(/(\d+)/);
  const durationWeeks = durationMatch ? parseInt(durationMatch[1], 10) : 4;
  // Heuristic: roughly 2-6 lessons per week.
  const minLessons = Math.max(3, durationWeeks * 2);
  const maxLessons = Math.max(minLessons + 2, durationWeeks * 6);
  const proportional = totalLessons >= minLessons && totalLessons <= maxLessons;
  out.push({
    name: "lesson_count_proportional_to_duration",
    pass: proportional,
    reason: proportional
      ? undefined
      : `${totalLessons} lessons for ${durationWeeks} weeks (expected ${minLessons}-${maxLessons})`,
  });

  return out;
}

interface LessonJudgement {
  alignsWithOutline: { pass: boolean; reason: string };
  hasWorkedExample: { pass: boolean; reason: string };
  takeawaysTopical: { pass: boolean; reason: string };
  clarity: { score: number; reason: string };
  depthForLevel: { score: number; reason: string };
}

async function judgeLesson(args: {
  topic: TopicEntry;
  moduleTitle: string;
  lessonTitle: string;
  lessonOutline: string;
  content: GeneratedLessonContent;
}): Promise<{ judgement: LessonJudgement; call: JudgeCall }> {
  const prompt = `You are a lesson content quality auditor.

Topic: "${args.topic.topic}"
Target level: ${args.topic.targetLevel}
Module: ${args.moduleTitle}
Lesson title: ${args.lessonTitle}
Lesson outline: ${args.lessonOutline}

Lesson content (markdown):
"""
${args.content.content.slice(0, 6000)}
"""

Key takeaways: ${JSON.stringify(args.content.keyTakeaways)}

Score the lesson:

Binary checks (pass/fail with one-line reason):
- alignsWithOutline: does the content cover what the outline promised?
- hasWorkedExample: is there at least one concrete worked example (code, problem, case study)?
- takeawaysTopical: are the keyTakeaways non-empty AND specifically tied to the lesson?

Likert 1-5 anchored:
- clarity: 1=confusing, 3=mostly clear, 5=exceptionally clear
- depthForLevel: 1=wrong depth, 3=acceptable depth for ${args.topic.targetLevel}, 5=ideal depth for ${args.topic.targetLevel}

Reply with strict JSON only:
{
  "alignsWithOutline": { "pass": true|false, "reason": "<short>" },
  "hasWorkedExample": { "pass": true|false, "reason": "<short>" },
  "takeawaysTopical": { "pass": true|false, "reason": "<short>" },
  "clarity": { "score": 1-5, "reason": "<short>" },
  "depthForLevel": { "score": 1-5, "reason": "<short>" }
}`;

  const { parsed, call } = await judgeJson<LessonJudgement>("rubric", prompt, {
    maxTokens: 700,
  });
  return { judgement: parsed, call };
}

interface RunTotals {
  judgeCalls: number;
  judgeTokens: number;
  judgeCostUsd: number;
  generatorTokens: number;
  generatorCostUsd: number;
}

function accumulateJudgeCalls(totals: RunTotals, calls: JudgeCall[]): void {
  for (const c of calls) {
    totals.judgeCalls += 1;
    totals.judgeTokens += c.usage?.totalTokens ?? 0;
    totals.judgeCostUsd += c.cost?.totalUsd ?? 0;
  }
}

function accumulateGenerator(
  totals: RunTotals,
  generator: GeneratorSpec,
  usage:
    | { promptTokens: number; completionTokens: number; totalTokens: number }
    | undefined
): void {
  if (!usage) return;
  totals.generatorTokens += usage.totalTokens;
  const cost = computeCost(generator.provider, generator.model, usage);
  totals.generatorCostUsd += cost?.totalUsd ?? 0;
}

export async function runEvaluation(opts: RunOptions): Promise<{ runDir: string; meta: RunMeta }> {
  const dataset = loadDataset(opts.topicsPath);
  const topics = opts.limit ? dataset.topics.slice(0, opts.limit) : dataset.topics;

  const outputRoot = opts.outputRoot ?? resolve(process.cwd(), "evals/runs");
  const runName = opts.runName ?? "run";

  if (opts.dryRun) {
    const estJudgePerTopic = 1 + 2 * 5; // syllabus + (2 lessons × ~5 judge calls)
    const estTopics = topics.length;
    console.log(`Dry run: would evaluate ${estTopics} topics`);
    console.log(`Estimated judge calls: ~${estJudgePerTopic * estTopics}`);
    console.log(`Generator: ${opts.generator.provider}:${opts.generator.model ?? "default"}`);
    console.log(`Output dir would be under: ${outputRoot}`);
    return {
      runDir: outputRoot,
      meta: emptyMeta(opts, dataset.version, outputRoot, runName),
    };
  }

  if (!existsSync(outputRoot)) mkdirSync(outputRoot, { recursive: true });
  const paths = preparePaths(runName, outputRoot);

  const meta: RunMeta = emptyMeta(opts, dataset.version, paths.runDir, runName);
  writeFileSync(paths.metaPath, JSON.stringify(meta, null, 2), "utf-8");

  const apiKey = resolveApiKey(opts.generator.provider);
  const syllabusService = new SyllabusGeneratorService({
    provider: opts.generator.provider,
    apiKey,
    model: opts.generator.model,
  });
  const lessonService = new LessonContentGeneratorService({
    provider: opts.generator.provider,
    apiKey,
    model: opts.generator.model,
  });

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const includeYouTube = opts.includeYouTube !== false && Boolean(youtubeApiKey);
  let youtubeService: YouTubePathService | null = null;
  if (includeYouTube && youtubeApiKey) {
    youtubeService = new YouTubePathService({
      provider: opts.generator.provider,
      apiKey,
      model: opts.generator.model,
      youtubeApiKey,
    });
  }

  const totals: RunTotals = {
    judgeCalls: 0,
    judgeTokens: 0,
    judgeCostUsd: 0,
    generatorTokens: 0,
    generatorCostUsd: 0,
  };
  let syllabusCount = 0;
  let lessonCount = 0;
  let citationsCount = 0;
  let youtubeCount = 0;

  for (const topic of topics) {
    console.log(`\n=== ${topic.id} (${topic.topic}) ===`);
    const syllabusResult = await runSyllabusEval(topic, syllabusService, opts.generator);
    accumulateGenerator(totals, opts.generator, syllabusResult.generationUsage);
    accumulateJudgeCalls(totals, syllabusResult.judgeCalls);
    appendJsonl(paths.syllabusPath, syllabusResult);
    syllabusCount += 1;

    if (!syllabusResult.generated) {
      console.log(`  syllabus generation failed: ${syllabusResult.generationError}`);
      continue;
    }

    const samples = sampleFirstAndLast(syllabusResult.generated);
    for (const sample of samples) {
      const lessonResult = await runLessonEval({
        topic,
        sample,
        syllabus: syllabusResult.generated,
        lessonService,
        generator: opts.generator,
      });
      accumulateGenerator(totals, opts.generator, lessonResult.generationUsage);
      accumulateJudgeCalls(totals, lessonResult.judgeCalls);
      appendJsonl(paths.lessonPath, lessonResult);
      lessonCount += 1;

      if (lessonResult.generated?.sources?.length) {
        const citationResult = await evalCitations({
          topicId: topic.id,
          lessonTitle: sample.lesson.title,
          sources: lessonResult.generated.sources,
          generator: opts.generator,
          rubricVersion: RUBRIC_VERSIONS.citations,
        });
        accumulateJudgeCalls(totals, citationResult.judgeCalls);
        appendJsonl(paths.citationsPath, citationResult);
        citationsCount += 1;
      }
    }

    if (youtubeService) {
      const youtubeResult = await runYouTubeEval({
        topic,
        service: youtubeService,
        generator: opts.generator,
        youtubeApiKey,
      });
      accumulateJudgeCalls(totals, youtubeResult.judgeCalls);
      appendJsonl(paths.youtubePath, youtubeResult);
      youtubeCount += 1;
    }
  }

  meta.finishedAt = new Date().toISOString();
  meta.totals = {
    syllabusEvals: syllabusCount,
    lessonEvals: lessonCount,
    citationEvals: citationsCount,
    youtubeEvals: youtubeCount,
    judgeCalls: totals.judgeCalls,
    judgeTokens: totals.judgeTokens,
    judgeCostUsd: totals.judgeCostUsd,
    generatorTokens: totals.generatorTokens,
    generatorCostUsd: totals.generatorCostUsd,
  };
  writeFileSync(paths.metaPath, JSON.stringify(meta, null, 2), "utf-8");

  const syllabusResults = readAllJsonl<SyllabusEvalResult>(paths.syllabusPath);
  const lessonResults = readAllJsonl<LessonEvalResult>(paths.lessonPath);
  const citationResults = readAllJsonl<CitationEvalResult>(paths.citationsPath);
  const youtubeResults = readAllJsonl<YouTubeEvalResult>(paths.youtubePath);

  writeSummary({
    runDir: paths.runDir,
    meta,
    syllabus: syllabusResults,
    lessons: lessonResults,
    citations: citationResults,
    youtube: youtubeResults,
  });

  return { runDir: paths.runDir, meta };
}

function emptyMeta(
  opts: RunOptions,
  topicsVersion: string,
  runDir: string,
  runName: string
): RunMeta {
  return {
    runName,
    startedAt: new Date().toISOString(),
    generator: opts.generator,
    judgeModels: {
      rubric: `groq:${JUDGE_MODELS.rubric}`,
      bounded: `groq:${JUDGE_MODELS.bounded}`,
    },
    topicsDataset: `${opts.topicsPath} (${topicsVersion})`,
    rubricVersions: RUBRIC_VERSIONS,
    limit: opts.limit,
    includeYouTube: opts.includeYouTube !== false,
    dryRun: Boolean(opts.dryRun),
    totals: {
      syllabusEvals: 0,
      lessonEvals: 0,
      citationEvals: 0,
      youtubeEvals: 0,
      judgeCalls: 0,
      judgeTokens: 0,
      judgeCostUsd: 0,
      generatorTokens: 0,
      generatorCostUsd: 0,
    },
  };
}

function readAllJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

async function runSyllabusEval(
  topic: TopicEntry,
  service: SyllabusGeneratorService,
  generator: GeneratorSpec
): Promise<SyllabusEvalResult> {
  const start = Date.now();
  try {
    const { syllabus, usage } = await service.generateSyllabus({
      topic: topic.topic,
      targetLevel: topic.targetLevel,
      estimatedDuration: topic.estimatedDuration,
    });
    const latency = Date.now() - start;
    const binary = checkSyllabusBinaries(topic, syllabus);
    const judgeCalls: JudgeCall[] = [];
    let likert: LikertScore[] = [];

    try {
      const { judgement, call } = await judgeSyllabus(topic, syllabus);
      judgeCalls.push(call);
      likert = [
        { name: "coverage", score: judgement.coverage.score, reason: judgement.coverage.reason },
        { name: "progression", score: judgement.progression.score, reason: judgement.progression.reason },
        {
          name: "levelAppropriateness",
          score: judgement.levelAppropriateness.score,
          reason: judgement.levelAppropriateness.reason,
        },
      ];
    } catch (err) {
      console.log(`  judge error (syllabus): ${(err as Error).message}`);
    }

    return {
      topicId: topic.id,
      topic: topic.topic,
      targetLevel: topic.targetLevel,
      domain: topic.domain,
      generator,
      rubricVersion: RUBRIC_VERSIONS.syllabus,
      generated: syllabus,
      generationLatencyMs: latency,
      generationUsage: usage,
      generationCost: computeCost(generator.provider, generator.model, usage),
      binary,
      likert,
      judgeCalls,
    };
  } catch (err) {
    return {
      topicId: topic.id,
      topic: topic.topic,
      targetLevel: topic.targetLevel,
      domain: topic.domain,
      generator,
      rubricVersion: RUBRIC_VERSIONS.syllabus,
      generated: null,
      generationError: (err as Error).message,
      generationLatencyMs: Date.now() - start,
      binary: [],
      likert: [],
      judgeCalls: [],
    };
  }
}

async function runLessonEval(args: {
  topic: TopicEntry;
  sample: ReturnType<typeof sampleFirstAndLast>[number];
  syllabus: GeneratedSyllabus;
  lessonService: LessonContentGeneratorService;
  generator: GeneratorSpec;
}): Promise<LessonEvalResult> {
  const { topic, sample, syllabus, lessonService, generator } = args;
  const start = Date.now();
  try {
    const { content, usage } = await lessonService.generateLessonContent({
      courseTitle: syllabus.courseTitle,
      courseDescription: syllabus.courseDescription,
      moduleTitle: sample.moduleTitle,
      lessonTitle: sample.lesson.title,
      lessonOutline: sample.lesson.outline,
      targetLevel: topic.targetLevel,
    });
    const latency = Date.now() - start;

    const judgeCalls: JudgeCall[] = [];
    let binary: BinaryScore[] = [];
    let likert: LikertScore[] = [];

    try {
      const { judgement, call } = await judgeLesson({
        topic,
        moduleTitle: sample.moduleTitle,
        lessonTitle: sample.lesson.title,
        lessonOutline: sample.lesson.outline,
        content,
      });
      judgeCalls.push(call);
      binary = [
        {
          name: "alignsWithOutline",
          pass: judgement.alignsWithOutline.pass,
          reason: judgement.alignsWithOutline.reason,
        },
        {
          name: "hasWorkedExample",
          pass: judgement.hasWorkedExample.pass,
          reason: judgement.hasWorkedExample.reason,
        },
        {
          name: "takeawaysTopical",
          pass: judgement.takeawaysTopical.pass,
          reason: judgement.takeawaysTopical.reason,
        },
      ];
      likert = [
        { name: "clarity", score: judgement.clarity.score, reason: judgement.clarity.reason },
        {
          name: "depthForLevel",
          score: judgement.depthForLevel.score,
          reason: judgement.depthForLevel.reason,
        },
      ];
    } catch (err) {
      console.log(`  judge error (lesson): ${(err as Error).message}`);
    }

    return {
      topicId: topic.id,
      topic: topic.topic,
      moduleTitle: sample.moduleTitle,
      lessonTitle: sample.lesson.title,
      lessonOutline: sample.lesson.outline,
      position: sample.position,
      generator,
      rubricVersion: RUBRIC_VERSIONS.lesson,
      generated: content,
      generationLatencyMs: latency,
      generationUsage: usage,
      generationCost: computeCost(generator.provider, generator.model, usage),
      binary,
      likert,
      judgeCalls,
    };
  } catch (err) {
    return {
      topicId: topic.id,
      topic: topic.topic,
      moduleTitle: sample.moduleTitle,
      lessonTitle: sample.lesson.title,
      lessonOutline: sample.lesson.outline,
      position: sample.position,
      generator,
      rubricVersion: RUBRIC_VERSIONS.lesson,
      generated: null,
      generationError: (err as Error).message,
      generationLatencyMs: Date.now() - start,
      binary: [],
      likert: [],
      judgeCalls: [],
    };
  }
}

async function runYouTubeEval(args: {
  topic: TopicEntry;
  service: YouTubePathService;
  generator: GeneratorSpec;
  youtubeApiKey: string | undefined;
}): Promise<YouTubeEvalResult> {
  const start = Date.now();
  try {
    const path = await args.service.generatePath({
      topic: args.topic.topic,
      skillLevel:
        args.topic.targetLevel === "beginner"
          ? "complete_beginner"
          : args.topic.targetLevel === "advanced"
            ? "advanced"
            : "intermediate",
      pathVariant: "standard",
    });
    return evalYouTubePath({
      topicId: args.topic.id,
      topic: args.topic.topic,
      targetLevel: args.topic.targetLevel,
      generator: args.generator,
      rubricVersion: RUBRIC_VERSIONS.youtube,
      generatedPath: path,
      generationLatencyMs: Date.now() - start,
      youtubeApiKey: args.youtubeApiKey,
    });
  } catch (err) {
    return evalYouTubePath({
      topicId: args.topic.id,
      topic: args.topic.topic,
      targetLevel: args.topic.targetLevel,
      generator: args.generator,
      rubricVersion: RUBRIC_VERSIONS.youtube,
      generatedPath: null,
      generationError: (err as Error).message,
      generationLatencyMs: Date.now() - start,
      youtubeApiKey: args.youtubeApiKey,
    });
  }
}

export async function regradeRun(runDir: string): Promise<void> {
  // FIXME: implement re-grading from cached generation outputs.
  // v1 only stores generation outputs inside *-results.jsonl alongside scores;
  // re-grading needs them split out so a fresh judge pass can reuse them.
  void runDir;
  throw new Error(
    "grade subcommand not implemented yet: re-grading requires cached generation outputs which v1 stores only inside *-results.jsonl. Use 'run' to regenerate, or extend runner to persist raw generations separately."
  );
}
