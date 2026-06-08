# Syllabus Rubric v1

Applied to: a single generated syllabus for one topic in `topics.v1.json`.

## Binary checks (mechanical, no LLM)

| name | description | pass condition |
|---|---|---|
| `every_module_has_lesson` | structural sanity | every module has at least one lesson |
| `no_duplicate_titles` | filler detection | no duplicate module titles and no duplicate lesson titles (case-insensitive) |
| `lesson_count_proportional_to_duration` | density heuristic | total lessons within `[2*weeks, 6*weeks]` (min 3) where weeks is parsed from `estimatedDuration` |

These checks are computed in `evals/lib/runner.ts::checkSyllabusBinaries`. Failures are recorded individually with a one-line reason.

## Likert 1-5 (judge model: `groq:openai/gpt-oss-120b`)

Judge prompt template (full text in `evals/lib/runner.ts::judgeSyllabus`):

> You are a curriculum quality auditor. Score the following syllabus on three dimensions using a 1-5 Likert scale.
>
> Topic: `<topic>`
> Target level: `<targetLevel>`
> Estimated duration: `<estimatedDuration>`
> Must-cover topics: `<mustCoverTopics joined>`
> Syllabus JSON: `<truncated to 8000 chars>`

### Coverage — does the syllabus hit the `mustCoverTopics`?

| score | anchor |
|---|---|
| 1 | Misses most must-cover topics. Example: a "React Hooks" syllabus that never mentions `useEffect` or `useContext`. |
| 3 | Hits roughly half. Example: a "Linear Algebra" syllabus that covers vectors and matrices but skips eigenvalues. |
| 5 | Hits every must-cover topic clearly, with dedicated lessons or unambiguous coverage. |

### Progression — do later modules build on earlier ones?

| score | anchor |
|---|---|
| 1 | Modules feel jumbled (e.g., advanced reaction mechanisms before bonding basics in Organic Chemistry). |
| 3 | Mostly linear with one or two breaks. Acceptable but not deliberate. |
| 5 | Each module clearly assumes and extends the previous. A Python syllabus that goes types → control flow → functions → data structures → I/O is 5. |

### Level-appropriateness — matches the `targetLevel`?

| score | anchor |
|---|---|
| 1 | Grossly mismatched (an "advanced" Deep Learning syllabus that starts with "what is a function"). |
| 3 | Roughly aligned but with several lessons too easy or too hard. |
| 5 | Calibrated to the target level: no wasted intro for advanced learners, no missing scaffolding for beginners. |

## Judge output schema (strict JSON)

```json
{
  "coverage": { "score": 1, "reason": "..." },
  "progression": { "score": 1, "reason": "..." },
  "levelAppropriateness": { "score": 1, "reason": "..." }
}
```

## Calibration target

Each Likert dimension targets Spearman ρ ≥ 0.6 against human labels in `evals/calibration/syllabus-labels.jsonl`. Dimensions below this threshold are flagged "uncalibrated" in run summaries (see `evals/lib/agreement.ts::CALIBRATION_THRESHOLD`).
