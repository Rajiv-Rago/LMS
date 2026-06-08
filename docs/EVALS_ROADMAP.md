# Kantigo Evals — Roadmap

The long-term plan for the eval harness. v1 (see `evals/README.md`) is the smallest useful slice. This doc captures what comes after, why, and the operating principles.

## 1. Vision & philosophy

LLM output quality is a stack of defenses, cheapest first:

1. **Objective signals** — URL liveness, JSON parse success, structural sanity (every module has lessons, no duplicate titles). No model in the loop. Fast and free.
2. **Bounded judge** — small model, narrow question, short answer. "Does this page cover X? Y/N." Catches the obvious failure modes.
3. **Calibrated rubric** — anchored 1-5 Likert with worked examples. Bigger judge. Only trusted to the extent that it agrees with humans (see calibration spine below).
4. **Pairwise tournaments** — side-by-side A/B with a judge, aggregated into Elo. Removes scale drift from absolute scoring.
5. **Ensemble / multi-judge** — multiple judges per scoring; disagreement → flag for human review.

Each layer is more expensive than the last. v1 ships layers 1, 2, and 3. v2+ adds the rest.

## 2. Surfaces evaluated

| surface | v1 in scope? | failure modes to catch |
|---|---|---|
| Syllabus | ✅ | missed must-cover topics, jumbled progression, wrong level, padding |
| Lesson content | ✅ (first + last only) | outline drift, missing worked example, vague takeaways, late-course laziness |
| Citations | ✅ | dead URLs, SEO-spam domains, hallucinated-but-plausible links, off-topic |
| YouTube curation | ✅ (title-only relevance) | dead/private videos, no-name channels, off-topic picks, wrong level |
| AI tutor (chat) | ❌ → v4 | multi-turn coherence, refusal calibration, hallucinated facts, getting derailed |
| Quiz generation | ❌ → v3 | ambiguous questions, wrong "correct" answer, trivially easy distractors |

## 3. The calibration spine

Every judge score in this harness should be backed by a human label set with measurable agreement (Cohen's kappa for binary, Spearman ρ for Likert). v1 ships the workflow with empty label files; the user populates them.

This is the load-bearing piece. Without it:
- We don't know whether a rubric change made things better or worse.
- We don't know whether a new judge model is actually a worse judge.
- We can't trust any single absolute number.

Calibration must be **re-run** whenever a rubric file, a judge model, or a judge prompt changes. The rubric version (`syllabus.v1.md`) bumps when this happens, and `meta.json` records which rubric versions a run used.

## 4. Maturity stages

### v1 — calibrated rubric harness (this release)

- Syllabus + lesson rubrics (anchored Likert + binary)
- Citations: liveness + domain quality + bounded relevance judge
- YouTube: liveness + channel sanity + bounded relevance judge (title-only)
- Cross-model bake-off (sequential absolute scoring)
- JSONL artifacts + `summary.md`
- Calibration command (kappa / Spearman)
- Two-run `diff`

### v2 — depth, breadth, and pairwise

- **Pairwise tournaments**: two generators score the same topic, judge picks a winner. Aggregate into Elo. Removes the "5 always means the same thing" assumption that absolute scoring depends on.
- **Full lesson sampling**: first / last / mid / random per syllabus. v1's first+last catches intro and laziness; mid+random catches everything between.
- **Golden citation sets per topic**: a hand-curated "ideal sources" list per topic. Score actual citations on overlap + diversity.
- **YouTube transcript-based relevance**: pull captions when available, send the first ~1000 chars to the judge. Cheaper than the user clicking through.

### v3 — grounding and ensemble

- **Claim grounding**: take a sentence from the lesson body, find the cited source it should be backed by, verify the source actually supports the claim. The first defense against confidently-wrong content.
- **Ensemble judges**: 2-3 judges per scoring (different models, same prompt). Disagreement flags the example for human review.
- **Drift tracking dashboard**: per-rubric-dimension scores over time. Detect when a prompt change silently degraded a surface that wasn't directly touched.
- **Quiz generation evals**: hand-grade and judge on question quality (unambiguous, distractor strength, answer correctness).

### v4 — multi-turn and CI gating

- **AI tutor evals**: multi-turn conversation traces. Coherence, refusal calibration, derailment resistance, hallucination per turn. Hardest surface; needs simulated-student scaffolding.
- **CI regression gate**: PRs that change prompts run a small regression set; merge gated on no significant per-dimension drop.

### v5 — the Pareto frontier

- **Cost / quality Pareto per surface**: which model is best at $0.01/syllabus? At $1.00/syllabus? Surface to the user as model recommendations.
- **Per-topic / per-level model picking**: maybe Gemini wins on STEM, Claude on humanities — make the runtime route accordingly.
- **Automated prompt search**: small genetic search over prompt variants, scored on the calibrated rubric. Only safe once calibration is rock-solid.

## 5. Run cadences

| cadence | when | scope |
|---|---|---|
| Regression | before merging any prompt PR | 3-5 topics, all rubrics |
| Bake-off | when adding a generator or swapping models | full dataset, ≥2 generators |
| Full | weekly / pre-release | full dataset, single generator |
| Calibration sweep | after rubric/judge change | calibration command on existing labels |

## 6. Failure-mode catalog

Known LLM failure modes the harness should be designed to catch:

- **Hallucinated URLs** — confident plausible-looking links that 404. Citation liveness layer.
- **Padded syllabuses** — duplicate topics across modules to fill space. `no_duplicate_titles` + lesson count proportional check.
- **Lazy late-course lessons** — quality cliff in the last module. First+last sampling.
- **Level mismatch** — beginner content for an advanced learner, or vice versa. `level-appropriateness` Likert.
- **SEO-spam citations** — links to content farms. Domain quality scoring.
- **Off-topic YouTube picks** — high-view-count videos that match the keyword but not the topic. Bounded relevance judge.
- **Vague key takeaways** — "this lesson covered important concepts." `takeawaysTopical` binary check.
- **JSON parse failures** — generator returns prose instead of JSON. Counted as `generationError` in run summary.
- **Outline drift** — content covers a different topic than the outline asked for. `alignsWithOutline` binary check.

## 7. Cost discipline

- Always prefer a heuristic to a judge call. Domain scoring is a 30-line file with no API spend.
- Bounded judge (`llama-3.1-8b-instant`) for binary checks; rubric judge (`gpt-oss-120b`) reserved for anchored Likert.
- `--dry-run` prints estimated spend before any tokens leave the box.
- Per-run token + cost budget recorded in `meta.json`. If a run blows past expected cost, that's a signal something changed (the generator started over-generating, the dataset grew, etc.).

## 8. Operating principles

- **Version everything**: prompts, rubrics, datasets. `meta.json` records which versions a run used.
- **Blind judges**: strip generator identifiers before sending to the judge. (v2 pairwise — until then this is theoretical.)
- **Never grade with the same model that generated.** Groq judges Kantigo's OpenAI/Anthropic/Gemini/Cerebras outputs; if Groq becomes a generator, switch the judge.
- **Calibration is non-negotiable.** Every dimension above the threshold can be cited as an absolute score. Below the threshold, the dimension is informational only.
- **Failure modes drive design.** Every new check earns its place by catching a real failure mode listed in section 6.
