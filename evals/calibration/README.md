# Calibration — hand-grading the judges

The judges in this harness output numbers. Until those numbers have been compared to a human, they are vibes. Calibration is the workflow that turns vibes into measurable agreement.

## TL;DR

1. Run the harness once: `tsx scripts/eval.ts run --generator openai:gpt-4o-mini --limit 5 --name smoke`
2. Open the resulting `evals/runs/<ts>-smoke/syllabus-results.jsonl` and `lesson-results.jsonl`.
3. For each row, copy the `topicId` (and `position` for lessons) into a new line in `syllabus-labels.jsonl` / `lesson-labels.jsonl`.
4. Fill in **your** scores using the same rubric the judge uses. Ignore what the judge said.
5. Run `tsx scripts/eval.ts calibrate --rubric syllabus` (or `lesson`).
6. Read the per-dimension Cohen's kappa / Spearman ρ. Anything below 0.6 is uncalibrated — the rubric needs sharpening or the judge prompt needs anchoring.

## Label file format

One JSON object per line. The opening two lines of each labels file are header/template markers (objects with `_format` / `_template` keys) — the calibrator skips any object that has a key starting with `_`. Delete those once you have real labels.

### Syllabus example

```json
{"exampleId": "2026-05-28T16-30-00-000Z-smoke/python-basics",
 "rubric": "syllabus",
 "likert": {"coverage": 5, "progression": 4, "levelAppropriateness": 5},
 "notes": "all must-cover topics present"}
```

### Lesson example

```json
{"exampleId": "2026-05-28T16-30-00-000Z-smoke/python-basics/first",
 "rubric": "lesson",
 "binary": {"alignsWithOutline": true, "hasWorkedExample": true, "takeawaysTopical": true},
 "likert": {"clarity": 4, "depthForLevel": 4},
 "notes": "intro is solid; takeaways could be sharper"}
```

`exampleId` is a free-form string — its only requirement is that it matches between the human label and the judge result. Use `<runDirName>/<topicId>[/<position>]` as the convention so a label can be cross-referenced.

## What "calibrated" means

- **Binary dimensions** → Cohen's kappa ≥ 0.6
- **Likert dimensions** → Spearman ρ ≥ 0.6

These are not magic numbers; they're the rough "substantial agreement" floor. Run summaries flag every dimension below the threshold as `uncalibrated`, and the harness will still emit relative comparisons (bake-off, diff) before calibration is populated — but absolute confidence in any one score is unearned until kappa says so.

## How many labels?

- **5 examples** = noisy but better than nothing
- **20 examples** = the harness starts producing usable kappa
- **50+ examples** = real signal

You do not need parity across topics. Label what's salient.

## When to re-calibrate

- After any rubric file change (the prompt the judge sees has shifted; old labels still apply but new judgments may drift).
- After swapping judge models.
- Quarterly, as a hygiene check.
