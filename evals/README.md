# Kantigo Evals — v1

Calibrated rubric harness for syllabus, lesson, citation, and YouTube outputs.

## What this is

A separate, additive eval system that calls Kantigo's generators (`SyllabusGeneratorService`, `LessonContentGeneratorService`, `YouTubePathService`) directly — no DB writes, no API routes, no queue. It produces JSONL artifacts plus a human-readable `summary.md` per run, lets you bake off generator models against each other, and includes the calibration workflow needed to make any of those scores trustworthy.

For the long-term plan and what's deferred, see `docs/EVALS_ROADMAP.md`.

## Prerequisites

- `GROQ_API_KEY` — the judge runs on Groq (`openai/gpt-oss-120b` for rubric, `llama-3.1-8b-instant` for bounded relevance checks).
- One of `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `CEREBRAS_API_KEY` for the generator under test.
- Optional: `YOUTUBE_API_KEY` for YouTube path evaluation. Without it, YouTube checks are skipped.

All keys read from `.env` via `dotenv/config` at CLI entry.

## Quick start

```bash
# Smoke run — 2 topics, no YouTube
tsx scripts/eval.ts run --generator openai:gpt-4o-mini --limit 2 --name smoke

# Full run
tsx scripts/eval.ts run --generator openai:gpt-4o-mini --name baseline

# Bake-off
tsx scripts/eval.ts run --generator anthropic:claude-sonnet-4-6 --name claude
tsx scripts/eval.ts diff evals/runs/<baseline-dir> evals/runs/<claude-dir>

# Dry-run cost estimate
tsx scripts/eval.ts run --generator openai:gpt-4o-mini --dry-run

# Calibrate the syllabus judge against your hand-labels
tsx scripts/eval.ts calibrate --rubric syllabus

# Skip YouTube even when YOUTUBE_API_KEY is set
tsx scripts/eval.ts run --generator openai:gpt-4o-mini --no-youtube
```

## Outputs

Each run writes a directory under `evals/runs/<ISO-timestamp>-<name>/`:

```
meta.json                  — run config + totals (cost, tokens, latency)
syllabus-results.jsonl     — one syllabus eval per topic
lesson-results.jsonl       — one eval per sampled lesson (first + last)
citations-results.jsonl    — one entry per sampled lesson with sources
youtube-results.jsonl      — one entry per topic (if YouTube was enabled)
summary.md                 — human-readable run summary
```

The `evals/runs/` directory itself is gitignored (only `.gitkeep` is tracked).

## Directory map

```
evals/
  datasets/topics.v1.json
  rubrics/{syllabus,lesson,citations,youtube}.v1.md
  calibration/
    {syllabus,lesson}-labels.jsonl
    README.md   ← how to hand-grade
  runs/         ← gitignored
  lib/          ← orchestration + graders
    runner.ts judge.ts dataset.ts sampler.ts
    citations.ts youtube.ts agreement.ts
    summarize.ts diff.ts cost.ts types.ts
  README.md     ← this file
scripts/eval.ts ← CLI entrypoint
docs/EVALS_ROADMAP.md
```

## CLI surface

```
tsx scripts/eval.ts run        --generator <provider:model> [--topics <path>] [--name <label>] [--limit N] [--no-youtube] [--dry-run]
tsx scripts/eval.ts calibrate  --rubric <syllabus|lesson|citations|youtube>
tsx scripts/eval.ts diff       <runDirA> <runDirB>
tsx scripts/eval.ts grade      --rubric <name> --run <runDir>     # stub in v1 — see runner.ts
```

## Cost & speed knobs

- `--limit N` cuts the topic set short — use for smoke / dev.
- `--dry-run` prints an estimate without spending tokens.
- `--no-youtube` disables YouTube path generation + checks.
- Static price table lives in `evals/lib/cost.ts`. Update prices there as providers change them.

## Calibration — read this before trusting any number

See [`evals/calibration/README.md`](./calibration/README.md). Until kappa/ρ ≥ 0.6 per dimension, the harness is good for **relative** comparisons (bake-off, diff) but **absolute** scores are unearned.
