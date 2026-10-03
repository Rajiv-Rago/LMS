# Course intake

Course planning uses a small, bounded sample rather than attempting a precise assessment.

1. **Direction:** offer topic-specific outcomes, existing requirements, a custom goal, and a broad introduction for learners who cannot choose yet. Ask for self-reported experience.
2. **Starting point:** ask three MCQs about prerequisites relevant to that direction. Each supports “I don’t know yet.” A short explanation is optional and is stored as learner context, not graded.
3. **Optional clarification:** mixed evidence for a non-beginner triggers two final prerequisite questions. Beginners and consistently correct or unknown answers stop after the first check.
4. **Review:** show one consolidated profile. The learner may edit the goal and starting level before generating.

The API controls transitions and enforces at most **three rounds and eight question items** (two direction items, three initial MCQs, one optional context item, two follow-up MCQs). `DIAGNOSTIC_MAX_ITERATIONS` may lower the round limit; values above three are clamped. Signed, user-bound, one-hour session state prevents the client from changing counters or answer keys. It is not a high-stakes exam or an anti-cheating mechanism.

Skipping before intake uses existing requirements or a broad introduction and a beginner default. Skipping later retains completed evidence and selected goals. Unavailable or malformed AI questions fall back to a reviewable profile with explicit assumptions, rather than blocking generation.

The structured `learnerProfile` travels through both syllabus entry points and the job handler, and is stored on the course. It contains goals, self-reported and estimated starting levels, possible strengths, topics to reinforce, assumptions, optional context, and whether assessment was skipped. The syllabus and lesson prompts treat that evidence as tentative and keep prerequisite refreshers.

Course depth (`foundations`, `standard`, `deep`) controls breadth and detail independently of starting level (`beginner`, `intermediate`, `advanced`). New intake courses can therefore have beginner explanations with deep coverage. Existing requests using `skillLevel`, `targetLevel`, or a legacy `knowledgeProfile` remain supported; no migration is required.

## Validation

- API tests cover early stopping, bounded follow-up, unknown answers, skips, lower limits, malformed output, session tampering, ownership, expiry, and model outages.
- UI tests cover optional explanations, editable summaries, skips, recoverable errors, and prevention of empty goals.
- Generation tests cover independent starting level and depth, plus goal/profile propagation to the syllabus and lessons.
- Live model quality is not implied by mocked tests; review real generated questions for relevance and difficulty during a pilot.
