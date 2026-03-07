# Phase 5: Inline Feedback - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Learners can improve course content by flagging issues and triggering instant AI regeneration, with safety nets against bad outputs. This phase adds a visible feedback form to AI text lessons, wires it to the existing LLM regeneration pipeline, introduces single-version content versioning for undo capability, and surfaces rate limit status in the UI. Only course owners and sharedWith users can trigger regeneration — enrolled-only learners don't see the form.

</domain>

<decisions>
## Implementation Decisions

### Feedback form placement
- Persistent section below lesson content — always visible, not in a collapsible accordion
- Only shown on AI-generated text lessons (not YouTube video lessons)
- Only shown to users with edit access (course owner + sharedWith users)
- Enrolled-only learners don't see the feedback section at all
- Suggestion chips above textarea: "Too advanced", "Too basic", "Outdated info", "Unclear explanation"
- Chips pre-fill the textarea; learner can still type custom text
- Validation: minimum 10 characters, maximum 500 (chips bypass the minimum)
- Form resets to empty after successful regeneration

### Regeneration in-progress state
- Lesson content replaced with skeleton loader while regeneration runs
- Existing async job polling pattern (POST returns jobId, client polls /api/jobs/{jobId})

### Success & undo flow
- After regeneration completes, new content appears with toast notification: "Lesson updated" + "Undo" button
- Undo available for ~30 seconds via the toast
- Clicking Undo reverts to the previous version stored in the database
- After toast dismisses, the previous version may be pruned — no persistent version history UI

### Error handling
- On LLM failure or timeout: error toast "Regeneration failed. Try again later."
- Old content stays untouched — no version change on failure

### Content versioning
- Store only one previous version per lesson (not full version history)
- Previous version exists as a safety net for the undo toast, not as a user-facing feature
- FDBK-07 (version history visible per lesson) is deferred to v2

### Regeneration scope & permissions
- Course owner and sharedWith users can trigger regeneration (reuses Phase 4 sharing model)
- Enrolled-only learners see lesson content without the feedback section
- Authorization via getCoursePermissions() — check canEdit or isSharedWith
- Regeneration updates the single source of truth — all learners see the new version on next page load
- No real-time push to other viewers

### Rate limit UX
- Regeneration shares the existing AI credits pool (10/day free tier, 1 credit per regeneration)
- Admin users exempt (Infinity credits — already configured in rateLimit.ts)
- Submit button shows remaining credits: "Improve with AI (7 left today)"
- When credits exhausted: button shows "No credits left — resets tomorrow" (disabled)
- Rate limit checked upfront on page load — if 0 credits, entire feedback section disabled
- No per-lesson cooldown beyond the daily credit limit

### Claude's Discretion
- Exact suggestion chip wording and styling
- How to store the previous version (embedded subdocument vs separate collection)
- Skeleton loader design for regeneration state
- Toast duration and animation
- How to fetch remaining credits efficiently (inline with lesson data or separate endpoint)

</decisions>

<specifics>
## Specific Ideas

- Feedback section heading: "Something wrong with this lesson?" — inviting, not formal
- Submit button text: "Improve with AI (X left today)" — combines action with rate limit info
- The existing "Improve with AI" collapsible section on the lesson page should be replaced with this always-visible design
- Suggestion chips should feel like quick-action buttons, not a dropdown or radio group

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Feedback UI already exists** (`app/(dashboard)/courses/[id]/modules/[moduleId]/lessons/[lessonId]/page.tsx` lines 599-655): Collapsible "Improve with AI" section with textarea and regenerate button — needs redesign but pattern is there
- **LessonContentGeneratorService** (`lib/ai/services/lessonContentGenerator.ts`): Already supports `feedback` and `previousContent` parameters in the prompt
- **AI generation queue handler** (`lib/queue/handlers/aiGeneration.ts`): `ai.generate-lesson-content` job handler already passes feedback through the pipeline
- **Generate API route** (`app/api/courses/ai/[courseId]/lessons/[lessonId]/generate/route.ts`): Accepts `{ feedback }` in request body, returns `{ jobId }` with 202 status
- **Rate limit system** (`lib/ai/rateLimit.ts`): `checkAIRateLimit()`, `enforceAIRateLimit()`, `addRateLimitHeaders()` — lesson generation already costs 1 credit
- **Job polling pattern**: Client polls `/api/jobs/{jobId}` every 2 seconds — established pattern from course generation
- **Toast component** (`components/ui/Toast.tsx`): Available for success/error notifications
- **getCoursePermissions()** (`lib/auth/coursePermissions.ts`): Returns `canEdit`, `isSharedWith`, `isEnrolled` flags

### Established Patterns
- Async AI generation: POST enqueues job → returns jobId → client polls for completion
- Rate limiting: `enforceAIRateLimit()` returns 429 with X-RateLimit-* headers
- Course ownership: `course.owner` (AI-generated) and `course.instructor` (admin-created)
- Content updates: `lesson.content` overwritten directly in queue handler (line 514 of aiGeneration.ts)
- Lesson model fields: `content`, `generationStatus`, `lessonOutline`, `keyTakeaways`, `generationConfig`

### Integration Points
- **Lesson model** (`lib/models/Lesson.ts`): Needs `previousContent` field (or subdocument) for versioning
- **Lesson page component**: Replace collapsible feedback section with persistent always-visible design
- **Generate route**: Add rate limit remaining info to response or separate endpoint
- **Queue handler** (`lib/queue/handlers/aiGeneration.ts` line 514): Save current content to `previousContent` before overwriting
- **Revert API**: New endpoint to swap `content` and `previousContent`

</code_context>

<deferred>
## Deferred Ideas

- FDBK-06: Section-level feedback — learner can flag specific paragraphs for regeneration (v2)
- FDBK-07: Feedback history visible per lesson — what was changed and why (v2)
- Suggestion collection from enrolled learners (non-editors submit feedback as suggestions for owner review) — future feature
- Full version history browser with diff view — future feature

</deferred>

---

*Phase: 05-inline-feedback*
*Context gathered: 2026-03-07*
