import "dotenv/config";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { runEvaluation, regradeRun } from "@/evals/lib/runner";
import { diffRuns } from "@/evals/lib/diff";
import { cohensKappa, spearmanCorrelation, disagreements, CALIBRATION_THRESHOLD } from "@/evals/lib/agreement";
import { judgeJson } from "@/evals/lib/judge";
import type {
  AIProviderName,
} from "@/lib/ai/types";
import type {
  CalibrationLabel,
  LessonEvalResult,
  RubricName,
  SyllabusEvalResult,
} from "@/evals/lib/types";

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [, , command, ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(token);
    }
  }
  return { command: command ?? "help", positional, flags };
}

function parseGeneratorSpec(spec: string | undefined): { provider: AIProviderName; model?: string } {
  if (!spec) throw new Error("--generator <provider:model> is required");
  const [providerRaw, ...modelParts] = spec.split(":");
  const provider = providerRaw as AIProviderName;
  const model = modelParts.length > 0 ? modelParts.join(":") : undefined;
  return { provider, model };
}

function printHelp(): void {
  console.log(`Kantigo evals CLI

Usage:
  tsx scripts/eval.ts run        --generator <provider:model> [--topics <path>] [--name <label>] [--limit N] [--no-youtube] [--dry-run]
  tsx scripts/eval.ts calibrate  --rubric <syllabus|lesson|citations|youtube>
  tsx scripts/eval.ts diff       <runDirA> <runDirB>
  tsx scripts/eval.ts grade      --rubric <name> --run <runDir>   (stub — see runner.ts)

Examples:
  tsx scripts/eval.ts run --generator openai:gpt-4o-mini --limit 2 --name smoke
  tsx scripts/eval.ts run --generator anthropic:claude-sonnet-4-6 --name claude
  tsx scripts/eval.ts diff evals/runs/2026-05-28T...-baseline evals/runs/2026-05-28T...-claude
  tsx scripts/eval.ts calibrate --rubric syllabus
`);
}

async function cmdRun(flags: Record<string, string | boolean>): Promise<void> {
  const generator = parseGeneratorSpec(typeof flags.generator === "string" ? flags.generator : undefined);
  const topicsPath =
    typeof flags.topics === "string" ? flags.topics : "evals/datasets/topics.v1.json";
  const runName = typeof flags.name === "string" ? flags.name : "run";
  const limit = typeof flags.limit === "string" ? parseInt(flags.limit, 10) : undefined;
  const includeYouTube = flags["no-youtube"] !== true;
  const dryRun = flags["dry-run"] === true;

  const { runDir, meta } = await runEvaluation({
    generator,
    topicsPath,
    runName,
    limit,
    includeYouTube,
    dryRun,
  });

  console.log(`\nRun complete: ${runDir}`);
  if (!dryRun) {
    console.log(
      `Judge calls: ${meta.totals.judgeCalls} (${meta.totals.judgeTokens} tokens, $${meta.totals.judgeCostUsd.toFixed(4)})`
    );
    console.log(
      `Generator: ${meta.totals.generatorTokens} tokens ($${meta.totals.generatorCostUsd.toFixed(4)})`
    );
  }
}

async function cmdDiff(positional: string[]): Promise<void> {
  if (positional.length < 2) {
    throw new Error("diff requires two run directory paths: tsx scripts/eval.ts diff <runDirA> <runDirB>");
  }
  const out = diffRuns(positional[0], positional[1]);
  console.log(out);
}

function loadLabels(path: string): CalibrationLabel[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>)
    .filter((obj) => !Object.keys(obj).some((k) => k.startsWith("_")))
    .map((obj) => obj as unknown as CalibrationLabel);
}

function findMostRecentRunDir(): string | null {
  const root = resolve(process.cwd(), "evals/runs");
  if (!existsSync(root)) return null;
  const entries = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  return entries.length > 0 ? resolve(root, entries[entries.length - 1]) : null;
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

async function cmdCalibrate(flags: Record<string, string | boolean>): Promise<void> {
  const rubric = (typeof flags.rubric === "string" ? flags.rubric : "") as RubricName;
  if (!rubric) {
    throw new Error("--rubric <syllabus|lesson|citations|youtube> is required");
  }

  if (rubric === "citations" || rubric === "youtube") {
    throw new Error(
      `calibration for "${rubric}" is not implemented in v1. The bounded judge for ${rubric} returns single-binary results; to calibrate, hand-label rows from <runDir>/${rubric}-results.jsonl and extend this command.`
    );
  }

  const labelsPath = resolve(
    process.cwd(),
    `evals/calibration/${rubric}-labels.jsonl`
  );
  const labels = loadLabels(labelsPath);
  if (labels.length === 0) {
    console.log(`No labels found in ${labelsPath} (skip the header/template rows).`);
    console.log("See evals/calibration/README.md for the workflow.");
    return;
  }

  const runDirFlag = typeof flags.run === "string" ? flags.run : null;
  const runDir = runDirFlag ?? findMostRecentRunDir();
  if (!runDir) {
    throw new Error("No run directories found under evals/runs/. Run an eval first or pass --run <dir>.");
  }

  const runDirName = runDir.split("/").filter(Boolean).pop() ?? "";
  console.log(`Calibrating ${rubric} judge against ${labels.length} label(s) from ${labelsPath}`);
  console.log(`Cross-referencing run dir: ${runDir}`);

  if (rubric === "syllabus") {
    const judgeResults = readJsonl<SyllabusEvalResult>(`${runDir}/syllabus-results.jsonl`);
    const byId = new Map<string, SyllabusEvalResult>();
    for (const r of judgeResults) byId.set(`${runDirName}/${r.topicId}`, r);

    const dims: Array<keyof NonNullable<CalibrationLabel["likert"]>> = [
      "coverage",
      "progression",
      "levelAppropriateness",
    ];
    for (const dim of dims) {
      const pairs = labels
        .map((l) => {
          const result = byId.get(l.exampleId);
          const judge = result?.likert.find((x) => x.name === dim);
          const human = l.likert?.[dim];
          if (!result || !judge || human === undefined) return null;
          return { exampleId: l.exampleId, judge: judge.score, human };
        })
        .filter((p): p is { exampleId: string; judge: number; human: number } => p !== null);

      if (pairs.length === 0) {
        console.log(`\n[${dim}] no matching label/result pairs`);
        continue;
      }
      const sp = spearmanCorrelation(pairs);
      const flag = sp.rho >= CALIBRATION_THRESHOLD ? "OK" : "UNCALIBRATED";
      console.log(`\n[${dim}] Spearman ρ = ${sp.rho.toFixed(3)} (n=${sp.n}) — ${flag}`);
      const disagreed = pairs.filter((p) => Math.abs(p.judge - p.human) >= 2);
      if (disagreed.length > 0) {
        console.log("  disagreements (|delta|>=2):");
        for (const d of disagreed.slice(0, 5)) {
          console.log(`    ${d.exampleId}: judge=${d.judge} human=${d.human}`);
        }
      }
    }
    return;
  }

  // rubric === "lesson"
  const judgeResults = readJsonl<LessonEvalResult>(`${runDir}/lesson-results.jsonl`);
  const byId = new Map<string, LessonEvalResult>();
  for (const r of judgeResults) byId.set(`${runDirName}/${r.topicId}/${r.position}`, r);

  const binaryDims = ["alignsWithOutline", "hasWorkedExample", "takeawaysTopical"];
  for (const dim of binaryDims) {
    const pairs = labels
      .map((l) => {
        const result = byId.get(l.exampleId);
        const judge = result?.binary.find((x) => x.name === dim);
        const human = l.binary?.[dim];
        if (!result || !judge || human === undefined) return null;
        return { exampleId: l.exampleId, judge: judge.pass ? 1 : 0, human: human ? 1 : 0 };
      })
      .filter((p): p is { exampleId: string; judge: number; human: number } => p !== null);
    if (pairs.length === 0) {
      console.log(`\n[${dim}] no matching label/result pairs`);
      continue;
    }
    const k = cohensKappa(pairs);
    const flag = k.kappa >= CALIBRATION_THRESHOLD ? "OK" : "UNCALIBRATED";
    console.log(
      `\n[${dim}] kappa = ${k.kappa.toFixed(3)} (n=${k.n}, agreement=${k.agreement.toFixed(2)}) — ${flag}`
    );
    const confusion = disagreements(pairs);
    if (confusion.length > 0) {
      console.log("  disagreements:");
      for (const d of confusion.slice(0, 5)) {
        console.log(`    ${d.exampleId}: judge=${d.judge} human=${d.human}`);
      }
    }
  }

  const likertDims = ["clarity", "depthForLevel"];
  for (const dim of likertDims) {
    const pairs = labels
      .map((l) => {
        const result = byId.get(l.exampleId);
        const judge = result?.likert.find((x) => x.name === dim);
        const human = l.likert?.[dim];
        if (!result || !judge || human === undefined) return null;
        return { exampleId: l.exampleId, judge: judge.score, human };
      })
      .filter((p): p is { exampleId: string; judge: number; human: number } => p !== null);
    if (pairs.length === 0) {
      console.log(`\n[${dim}] no matching label/result pairs`);
      continue;
    }
    const sp = spearmanCorrelation(pairs);
    const flag = sp.rho >= CALIBRATION_THRESHOLD ? "OK" : "UNCALIBRATED";
    console.log(`\n[${dim}] Spearman ρ = ${sp.rho.toFixed(3)} (n=${sp.n}) — ${flag}`);
  }
}

async function cmdGrade(flags: Record<string, string | boolean>): Promise<void> {
  const runDir = typeof flags.run === "string" ? flags.run : "";
  if (!runDir) throw new Error("--run <runDir> is required");
  await regradeRun(runDir);
}

// Silence the unused-import warning for judgeJson — it's wired in case the
// calibrate path needs to re-run a judge inline in a follow-up.
void judgeJson;

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  switch (args.command) {
    case "run":
      await cmdRun(args.flags);
      break;
    case "diff":
      await cmdDiff(args.positional);
      break;
    case "calibrate":
      await cmdCalibrate(args.flags);
      break;
    case "grade":
      await cmdGrade(args.flags);
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${args.command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
