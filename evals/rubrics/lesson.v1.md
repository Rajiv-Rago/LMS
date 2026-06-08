# Lesson Content Rubric v1

Applied to: the **first** and **last** lesson of each generated syllabus (see `evals/lib/sampler.ts`). Mid/random sampling is deferred to v2.

## Binary checks (judge model: `groq:openai/gpt-oss-120b`)

| name | description |
|---|---|
| `alignsWithOutline` | does the generated content cover what the outline promised? |
| `hasWorkedExample` | is there at least one concrete worked example (code block, problem, case study)? |
| `takeawaysTopical` | are `keyTakeaways` non-empty AND specifically tied to the lesson (not generic platitudes)? |

## Likert 1-5 (same judge model)

### Clarity

| score | anchor |
|---|---|
| 1 | Confusing. Jargon without definition; broken or missing structure. |
| 3 | Mostly clear. Some sentences need a re-read. |
| 5 | Exceptionally clear. A learner at the target level can read once and understand. |

### Depth-for-level

| score | anchor |
|---|---|
| 1 | Wrong depth (beginner content for an advanced lesson, or vice versa). |
| 3 | Acceptable for the level; either slightly thin or slightly over the top. |
| 5 | Ideal depth: enough scaffolding for the target level, no padding, no condescension. |

## Judge output schema (strict JSON)

```json
{
  "alignsWithOutline":  { "pass": true,  "reason": "..." },
  "hasWorkedExample":   { "pass": false, "reason": "..." },
  "takeawaysTopical":   { "pass": true,  "reason": "..." },
  "clarity":            { "score": 4,    "reason": "..." },
  "depthForLevel":      { "score": 3,    "reason": "..." }
}
```

## Calibration target

Cohen's kappa ≥ 0.6 on binary dimensions, Spearman ρ ≥ 0.6 on Likert dimensions, against `evals/calibration/lesson-labels.jsonl`. Uncalibrated dimensions are flagged in run summaries.
