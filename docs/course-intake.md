# Adaptive learner assessment

The learner chooses goals and a self-reported experience level before an optional knowledge check. Course depth stays independent of starting level. Existing goals, context and AI provider selection are preserved.

`lib/ai/intake/graph.ts` uses a real LangGraph `StateGraph`:

1. **Evaluate**: the LLM evaluates context and full question/answer/explanation history. It returns a validated decision about sufficiency, tentative starting level, demonstrated strengths, knowledge gaps, prerequisite coverage, uncertainties and next focus. Confidence is uncalibrated metadata; no confidence threshold controls termination.
2. **Guard**: deterministic rules finish on sufficiency, hard limits, repeated low gain, skipping or model failure.
3. **Questions**: the LLM generates targeted MCQs. Code validates answer keys and distinct options, enforces budgets, and removes duplicate/near-identical question text. The graph ends at this human-answer boundary.
4. **Profile**: completion produces a structured learner profile. The existing syllabus API validates it and `SyllabusGeneratorService` includes it in its prompt, using starting level independently of depth. Profile generation requires no additional LLM call, so it remains available after model failure.

## Bounds and defaults

- At most **five knowledge rounds**, **three MCQs per round**, **ten MCQs total**. Goals, experience selection and the optional context explanation are intake metadata, not scored assessment questions. The model may ask fewer questions or finish before the first knowledge round.
- `DIAGNOSTIC_MAX_ITERATIONS` defaults to five and can lower the round ceiling. Each session snapshots that ceiling; values above five are clamped. Question budgets are configured by constants in `profile.ts` and `session.ts`; session validation also enforces them.
- Two consecutive answered rounds without useful new evidence stop probing: either every answer is unknown, or the model's strengths, gaps, uncertainties and starting-level assessment remain unchanged. Confidence changes do not count as information gain. This is a bounded heuristic, not a calibrated measure of uncertainty.
- Exact normalized questions and token-set similarity of at least 0.8 are rejected. The model is also instructed against semantic repetition. Semantic equivalence cannot be guaranteed by a text heuristic; repeated low-gain rounds and the budgets bound remaining redundancy. A batch with no accepted questions ends immediately; oversized or invalid batches terminate safely rather than retry indefinitely.
- Model calls have a 12-second deadline and share a 25-second request budget; timeout abort signals reach the LangChain invocation. No automatic application retry loop. Provider internals may retry within that deadline. The route allows 60 seconds including DB I/O.
- Invalid structured output, provider errors and timeouts produce a partial profile. If evaluation fails after receiving answers, deterministic observed evidence is preserved and uncertainty is explicit. A skip calls no model.

## Persistence and resume

Validated graph state lives in MongoDB's `learnerassessments` collection with user ownership, revision and a seven-day expiry/TTL index. It includes goals/preferences, self-report, all issued questions and answer keys, submitted answers/explanations, observations, counters, latest decision, low-gain count, completion reason and final profile. No migration or separate LangGraph service is required. MongoDB must be available, as for other app features.

The API returns an opaque UUID and revision, never answer keys or raw stored history. Auth and CSRF checks apply to start, mutation and resume. Expiry is checked by queries even before the TTL cleanup runs. Updates compare the stored revision atomically: a concurrent or replayed mutation cannot advance counters or overwrite newer answers. Concurrent inference can occur before that comparison, but only one result is committed.

The browser remembers the UUID alongside a validated, versioned course configuration in local storage. A dashboard refresh restores that configuration and resumes the persisted pending round or summary. The draft is cleared when syllabus generation is accepted, so a failed generation request leaves the assessment recoverable. A lost mutation response can be recovered with `resume`; stale submissions receive 409 and the UI reloads current state. Ownership is checked server-side even on shared browsers. Submitted answers are checkpointed when a graph invocation finishes, including failure/timeout fallbacks. A process crash before that commit leaves the prior pending round available for retry; unsubmitted browser input is not checkpointed. Cross-device automatic discovery is not provided.

API actions at `/api/courses/diagnostic`:

- `start`: topic, optional additionalContext and aiSelection.
- `resume`: token; returns current persisted state without inference.
- `goals`: token, revision, goalIndex or customGoal, optional experience.
- `evaluate`: token, revision, one answer per current question (`-1` means unknown), optional explanation.
- `skip`: token, revision, optional goal fields when still choosing goals.

Old signed one-hour intake tokens are intentionally unsupported. An assessment started before this update must restart. Existing saved learner profiles remain accepted: prerequisite coverage and uncertainties are optional additions.

## Validation

Graph tests exercise genuine LangGraph transitions and stopping rules. API tests use a real ephemeral MongoDB instance and mocked provider outputs to verify persisted resume, ownership, stale submissions, atomic concurrent writes, partial evidence, private answer keys and cancellation. UI tests cover review, skip, edits, errors and reload resume. Provider and syllabus tests cover the existing integration boundary. Live model quality and authenticated browser flows should be checked on the feature preview before merging.
