# Phase 5: Inline Feedback - Research

**Researched:** 2026-03-07
**Domain:** AI content regeneration with feedback, content versioning, rate limit UX
**Confidence:** HIGH

## Summary

Phase 5 transforms the existing collapsible "Improve with AI" section on AI text lessons into an always-visible feedback form with suggestion chips, wires it through the existing async job queue for LLM regeneration, adds single-version undo capability via a `previousContent` field on the Lesson model, and surfaces rate limit credits in the UI.

The codebase already has nearly all the backend infrastructure: `LessonContentGeneratorService` accepts `feedback` and `previousContent` parameters, the `ai.generate-lesson-content` queue handler passes feedback through, the generate API route accepts `{ feedback }` in the request body, and the job polling pattern is established. The main work is: (1) adding `previousContent` to the Lesson schema and saving current content before overwrite, (2) creating a revert endpoint, (3) adding a read-only credits check endpoint, (4) expanding authorization from owner-only to owner+sharedWith, and (5) redesigning the frontend feedback section.

**Primary recommendation:** Leverage every existing backend pattern. The bulk of new code is the UI redesign and three small backend additions (previousContent field, revert endpoint, credits check endpoint).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Persistent section below lesson content -- always visible, not in a collapsible accordion
- Only shown on AI-generated text lessons (not YouTube video lessons)
- Only shown to users with edit access (course owner + sharedWith users)
- Enrolled-only learners don't see the feedback section at all
- Suggestion chips above textarea: "Too advanced", "Too basic", "Outdated info", "Unclear explanation"
- Chips pre-fill the textarea; learner can still type custom text
- Validation: minimum 10 characters, maximum 500 (chips bypass the minimum)
- Form resets to empty after successful regeneration
- Lesson content replaced with skeleton loader while regeneration runs
- Existing async job polling pattern (POST returns jobId, client polls /api/jobs/{jobId})
- After regeneration completes, new content appears with toast notification: "Lesson updated" + "Undo" button
- Undo available for ~30 seconds via the toast
- Clicking Undo reverts to the previous version stored in the database
- After toast dismisses, the previous version may be pruned -- no persistent version history UI
- On LLM failure or timeout: error toast "Regeneration failed. Try again later."
- Old content stays untouched -- no version change on failure
- Store only one previous version per lesson (not full version history)
- Previous version exists as a safety net for the undo toast, not as a user-facing feature
- Course owner and sharedWith users can trigger regeneration (reuses Phase 4 sharing model)
- Enrolled-only learners see lesson content without the feedback section
- Authorization via getCoursePermissions() -- check canEdit or isSharedWith
- Regeneration updates the single source of truth -- all learners see the new version on next page load
- No real-time push to other viewers
- Regeneration shares the existing AI credits pool (10/day free tier, 1 credit per regeneration)
- Admin users exempt (Infinity credits -- already configured in rateLimit.ts)
- Submit button shows remaining credits: "Improve with AI (7 left today)"
- When credits exhausted: button shows "No credits left -- resets tomorrow" (disabled)
- Rate limit checked upfront on page load -- if 0 credits, entire feedback section disabled
- No per-lesson cooldown beyond the daily credit limit
- Feedback section heading: "Something wrong with this lesson?" -- inviting, not formal
- Submit button text: "Improve with AI (X left today)" -- combines action with rate limit info
- The existing "Improve with AI" collapsible section on the lesson page should be replaced with this always-visible design
- Suggestion chips should feel like quick-action buttons, not a dropdown or radio group

### Claude's Discretion
- Exact suggestion chip wording and styling
- How to store the previous version (embedded subdocument vs separate collection)
- Skeleton loader design for regeneration state
- Toast duration and animation
- How to fetch remaining credits efficiently (inline with lesson data or separate endpoint)

### Deferred Ideas (OUT OF SCOPE)
- FDBK-06: Section-level feedback -- learner can flag specific paragraphs for regeneration (v2)
- FDBK-07: Feedback history visible per lesson -- what was changed and why (v2)
- Suggestion collection from enrolled learners (non-editors submit feedback as suggestions for owner review) -- future feature
- Full version history browser with diff view -- future feature
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FDBK-01 | Learner can submit feedback on a lesson (text input describing the issue) | Existing textarea + generate flow on lesson page (lines 599-655); suggestion chips + validation rules from CONTEXT |
| FDBK-02 | Submitting feedback triggers instant LLM regeneration of the lesson content | `LessonContentGeneratorService` already accepts `feedback`/`previousContent`; queue handler `ai.generate-lesson-content` passes feedback through; generate route accepts `{ feedback }` |
| FDBK-03 | Previous lesson content is preserved (versioned) so bad regenerations can be reverted | New `previousContent` field on Lesson model + new revert API endpoint |
| FDBK-04 | Feedback UI is visible and discoverable (not hidden in a collapsed accordion) | Replace collapsible section with persistent always-visible design |
| FDBK-05 | Regeneration has rate limiting to prevent cost abuse | Existing `enforceAIRateLimit()` in generate route (1 credit per lesson); new read-only credits endpoint for UI display |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 | App Router, API routes | Project framework |
| React | 19 | UI components | Project framework |
| Tailwind CSS | 4 | Styling | Project framework |
| Mongoose | 8 | MongoDB ODM | Project database layer |
| Zod | 4 | Request validation | Project validation standard |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| useToast hook | custom | Toast notifications | Success/error/undo toast |
| ContentGenerationSkeleton | custom | Loading skeleton | During regeneration |
| MarkdownContent | custom | Render lesson content | Display regenerated content |
| getCoursePermissions | custom | Authorization | Check canEdit/isSharedWith |
| enforceAIRateLimit | custom | Rate limiting | Generate route enforcement |

### No New Dependencies
This phase requires zero new npm packages. Everything needed is already in the project.

## Architecture Patterns

### Recommended Changes Structure
```
lib/models/Lesson.ts             # Add previousContent + previousKeyTakeaways fields
lib/ai/rateLimit.ts              # Add read-only getAICreditsRemaining() function
lib/queue/handlers/aiGeneration.ts  # Save previousContent before overwrite; expand auth
app/api/courses/ai/[courseId]/lessons/[lessonId]/generate/route.ts  # Expand auth to sharedWith
app/api/courses/ai/[courseId]/lessons/[lessonId]/revert/route.ts    # NEW: revert endpoint
app/api/ai/credits/route.ts      # NEW: read-only credits check
components/lesson/FeedbackSection.tsx  # NEW: extracted feedback component
app/(dashboard)/courses/[id]/modules/[moduleId]/lessons/[lessonId]/page.tsx  # Integrate FeedbackSection
```

### Pattern 1: Embedded Previous Content (Recommended)
**What:** Store `previousContent` and `previousKeyTakeaways` as top-level fields on the Lesson document, not a separate collection.
**When to use:** Single-version undo where previous content is ephemeral.
**Why:** Avoids a new collection, keeps reads simple (no joins), previous content lives with the lesson, and cleanup is just unsetting fields. The Lesson document is already the unit of content -- adding two more string fields is trivial.
```typescript
// In Lesson schema:
previousContent: { type: String, default: undefined },
previousKeyTakeaways: [{ type: String }],
```

### Pattern 2: Read-Only Credits Check
**What:** A lightweight function that queries `AIUsage` without incrementing, returning `{ remaining, limit, resetAt }`.
**When to use:** Displaying credit count in the UI before the user takes action.
**Why:** The existing `checkAIRateLimit` atomically increments -- calling it just to display remaining credits would consume a credit. Need a separate read-only query.
```typescript
// In lib/ai/rateLimit.ts:
export async function getAICreditsRemaining(
  userId: string,
  tier: SubscriptionTier,
  category: AIUsageCategory = "credits"
): Promise<{ remaining: number; limit: number; resetAt: string }> {
  const limit = DAILY_LIMITS[category][tier];
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const resetAt = tomorrow.toISOString();

  if (!env.AI_RATE_LIMIT_ENABLED || !isFinite(limit)) {
    return { remaining: Infinity, limit, resetAt };
  }

  await dbConnect();
  const dateKey = getDateKey();
  const doc = await AIUsage.findOne({ user: userId, category, dateKey });
  const used = doc?.count ?? 0;
  return { remaining: Math.max(0, limit - used), limit, resetAt };
}
```

### Pattern 3: Authorization Expansion
**What:** Change from `Course.findOne({ owner: userId })` to `getCoursePermissions()` check for `canEdit || isSharedWith`.
**Where:** Both the generate API route and the queue handler.
**Critical detail:** The queue handler currently uses `Course.findOne({ _id: courseId, owner: userId })` at line 430-432. This must change to `Course.findById(courseId)` followed by a permissions check. However, the queue handler runs in a background job context without a full HTTP request -- it only has `userId`. The simplest approach: change to `Course.findById(courseId)` and then check `course.owner === userId || course.instructor === userId || course.sharedWith?.includes(userId)` directly, since `getCoursePermissions` requires a JWTPayload and does an async enrollment check (unnecessary in the queue context).

### Pattern 4: Undo Toast with Action
**What:** Toast with an "Undo" button that calls the revert endpoint within a 30-second window.
**Implementation detail:** The current toast system auto-dismisses after 5 seconds (`AUTO_DISMISS_MS`). The undo toast needs ~30 seconds. Two approaches:
1. Add an `action` callback + `duration` override to the toast system
2. Manage the undo state separately from the toast system (simpler, avoids modifying shared infra)

**Recommendation:** Option 2 -- manage undo state as local component state with a separate floating undo bar. This avoids modifying the global toast system and gives full control over duration, animation, and the undo button.

### Anti-Patterns to Avoid
- **Modifying the global toast system for undo:** The toast system is shared infrastructure. Adding action buttons and variable durations adds complexity for a single use case. Keep undo state local.
- **Separate collection for previousContent:** Adds a join/populate step for every lesson read, plus cleanup concerns. Embedded fields are simpler.
- **Polling for credits on an interval:** Credits change only when the user triggers a regeneration. Fetch once on mount and update locally after each regeneration response.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue | Custom queue | Existing `enqueueJob` + `getJobStatus` | Already battle-tested in the project |
| Rate limiting | Custom counter | Existing `enforceAIRateLimit` + new `getAICreditsRemaining` | Atomic increment, TTL indexes, tier support |
| Content regeneration | Custom LLM call | Existing `LessonContentGeneratorService` | Already handles feedback/previousContent in prompts |
| Authorization | Custom ownership check | `getCoursePermissions()` | Handles owner, instructor, admin, sharedWith, enrollment |
| Markdown rendering | Custom renderer | Existing `MarkdownContent` component | Already styled for dark mode |
| Loading skeleton | Custom skeleton | Existing `ContentGenerationSkeleton` | Already matches lesson layout shape |

## Common Pitfalls

### Pitfall 1: Race Condition on Content Save
**What goes wrong:** Two users (owner + sharedWith) trigger regeneration simultaneously. Both jobs read current content as "previous" and both overwrite.
**Why it happens:** The queue handler doesn't lock the lesson document.
**How to avoid:** This is acceptable for v1 -- the CONTEXT explicitly states "No real-time push to other viewers" and the scenario is rare. The last write wins. If needed later, add optimistic locking with a version counter.
**Warning signs:** Two users on the same lesson page simultaneously.

### Pitfall 2: Undo After Content Changes
**What goes wrong:** User A regenerates, user B regenerates before A clicks Undo. A's undo overwrites B's new content.
**Why it happens:** `previousContent` is per-lesson, not per-user.
**How to avoid:** The revert endpoint should check that `previousContent` matches what the user expects. Include a timestamp or content hash in the undo payload. Simpler approach: since undo window is 30 seconds and concurrent editing is rare, this is acceptable risk for v1.
**Warning signs:** Same as above -- concurrent editing.

### Pitfall 3: Generate Route Auth Mismatch
**What goes wrong:** The API route allows sharedWith users but the queue handler rejects them because it still queries `Course.findOne({ owner: userId })`.
**Why it happens:** Auth check exists in two places (route + handler) and only one gets updated.
**How to avoid:** Update BOTH the route and the handler. The handler auth check is at line 430-432 of `aiGeneration.ts`.
**Warning signs:** sharedWith users see the form but regeneration silently fails.

### Pitfall 4: Credits Display Stale After Regeneration
**What goes wrong:** User regenerates successfully but the button still shows old credit count.
**Why it happens:** Credits were fetched on page load and not updated after regeneration.
**How to avoid:** After successful regeneration (job completes), decrement the local credit count by 1. The generate route also returns rate limit headers (`X-RateLimit-Remaining`) -- parse those from the POST response.
**Warning signs:** Button shows "7 left" before and after regeneration.

### Pitfall 5: Validation Mismatch Between Chips and Custom Text
**What goes wrong:** Chip text is shorter than 10 characters, but the validation requires minimum 10 characters.
**Why it happens:** CONTEXT says "chips bypass the minimum" -- this needs explicit handling.
**How to avoid:** Track whether feedback came from a chip selection. If chip-only, skip the minimum length check. If custom text (or chip + edits), enforce the 10-character minimum.
**Warning signs:** User clicks "Too basic" chip and gets a validation error.

### Pitfall 6: Skeleton Loader Replaces Content Prematurely
**What goes wrong:** User sees skeleton immediately on click, but the POST hasn't even returned yet (might fail with 429).
**Why it happens:** Setting `generating=true` before the POST response.
**How to avoid:** Show skeleton only after the POST returns 202 (job enqueued). If POST returns 429, show the rate limit message without replacing content.
**Warning signs:** Content disappears, then error appears, then old content comes back.

## Code Examples

### Adding previousContent to Lesson Model
```typescript
// In lib/models/Lesson.ts -- add to ILesson interface:
previousContent?: string;
previousKeyTakeaways?: string[];

// In lessonSchema:
previousContent: {
  type: String,
},
previousKeyTakeaways: [{
  type: String,
  maxlength: [500, "Key takeaway cannot exceed 500 characters"],
}],
```

### Saving Previous Content Before Overwrite (Queue Handler)
```typescript
// In lib/queue/handlers/aiGeneration.ts, ai.generate-lesson-content handler
// Before line 514 (lesson.content = content.content):
if (lesson.content) {
  lesson.previousContent = lesson.content;
  lesson.previousKeyTakeaways = lesson.keyTakeaways || [];
}
lesson.content = content.content;
lesson.keyTakeaways = content.keyTakeaways;
```

### Revert Endpoint
```typescript
// app/api/courses/ai/[courseId]/lessons/[lessonId]/revert/route.ts
// POST handler: swaps content and previousContent
// Auth: getCoursePermissions -> canEdit || isSharedWith
// Returns 404 if no previousContent exists
// Returns 200 with updated lesson
```

### Read-Only Credits Endpoint
```typescript
// app/api/ai/credits/route.ts
// GET handler: returns { remaining, limit, resetAt }
// Uses getAICreditsRemaining() from rateLimit.ts
// Auth: requireAuth
```

### Suggestion Chips Component Pattern
```typescript
const SUGGESTION_CHIPS = [
  "Too advanced",
  "Too basic",
  "Outdated info",
  "Unclear explanation",
] as const;

// Chip click fills textarea, sets chipSelected flag
// chipSelected bypasses 10-char minimum on submit
```

### Expanded Auth Check in Generate Route
```typescript
// Replace:
//   const course = await Course.findOne({ _id: courseId, owner: user.userId });
// With:
const course = await Course.findById(courseId);
if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
const perms = await getCoursePermissions(course, user);
if (!perms.canEdit && !perms.isSharedWith) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Collapsible feedback accordion | Always-visible persistent section | This phase | More discoverable, matches FDBK-04 |
| Owner-only regeneration | Owner + sharedWith regeneration | This phase | Enables collaborative improvement |
| No content versioning | Single previous version stored | This phase | Enables undo, matches FDBK-03 |
| Credits enforced server-side only | Credits displayed in UI + enforced server-side | This phase | Better UX, matches FDBK-05 |

## Open Questions

1. **Toast vs Floating Undo Bar**
   - What we know: Current toast auto-dismisses at 5s, undo needs 30s window
   - What's unclear: Whether to extend toast system or build separate undo bar
   - Recommendation: Separate undo bar -- simpler, no shared infrastructure changes, full control over 30s timer and undo button. Implement as local component state in the lesson page.

2. **Credits Fetch Strategy**
   - What we know: Need credits count on page load; no existing endpoint
   - What's unclear: Inline with lesson API response vs separate endpoint
   - Recommendation: Separate `GET /api/ai/credits` endpoint. Keeps the lesson API clean (it serves all users, including unauthenticated), and credits are user-specific not lesson-specific. Cache the value in component state and update locally after regeneration.

3. **Queue Handler Auth for sharedWith Users**
   - What we know: Queue handler uses `Course.findOne({ owner: userId })` which rejects sharedWith users
   - What's unclear: Whether to import getCoursePermissions into the handler (requires JWTPayload) or check sharedWith directly
   - Recommendation: Check sharedWith directly in the handler: `Course.findOne({ _id: courseId, $or: [{ owner: userId }, { instructor: userId }, { sharedWith: userId }] })`. This avoids importing the full permissions system into the queue context and the unnecessary enrollment check.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 |
| Config file | `jest.config.ts` |
| Quick run command | `npm test -- --testPathPattern` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FDBK-01 | Feedback textarea accepts input, chips pre-fill, validation enforced | unit | `npm test -- __tests__/integration/courses/lessonFeedback.test.ts -x` | Wave 0 |
| FDBK-02 | Submit triggers regeneration via queue, lesson content updates | integration | `npm test -- __tests__/integration/queue/aiGeneration.test.ts -x` | Partial (existing test covers generate, needs feedback case) |
| FDBK-03 | previousContent saved before overwrite; revert endpoint swaps back | integration | `npm test -- __tests__/integration/courses/lessonRevert.test.ts -x` | Wave 0 |
| FDBK-04 | Feedback section visible (not collapsed) for canEdit/isSharedWith users | unit | `npm test -- __tests__/integration/courses/lessonFeedback.test.ts -x` | Wave 0 |
| FDBK-05 | Rate limit enforced; credits endpoint returns remaining; UI disables when 0 | integration | `npm test -- __tests__/integration/courses/lessonFeedback.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="lessonFeedback|lessonRevert|aiGeneration" -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/integration/courses/lessonFeedback.test.ts` -- covers FDBK-01, FDBK-04, FDBK-05 (generate route auth expansion, credits endpoint, feedback validation)
- [ ] `__tests__/integration/courses/lessonRevert.test.ts` -- covers FDBK-03 (revert endpoint, previousContent preservation)
- [ ] Extend `__tests__/integration/queue/aiGeneration.test.ts` -- add test case for `ai.generate-lesson-content` with feedback parameter saving previousContent

## Sources

### Primary (HIGH confidence)
- **Project codebase** -- all findings verified by reading actual source files
  - `lib/models/Lesson.ts` -- current schema, no previousContent field
  - `lib/ai/services/lessonContentGenerator.ts` -- already accepts feedback/previousContent params
  - `lib/queue/handlers/aiGeneration.ts` -- ai.generate-lesson-content handler at lines 405-567
  - `app/api/courses/ai/[courseId]/lessons/[lessonId]/generate/route.ts` -- current generate endpoint
  - `lib/ai/rateLimit.ts` -- checkAIRateLimit, enforceAIRateLimit, addRateLimitHeaders
  - `lib/auth/coursePermissions.ts` -- getCoursePermissions with canEdit, isSharedWith
  - `components/ui/Toast.tsx` + `lib/hooks/useToast.ts` -- current toast system (5s auto-dismiss)
  - `app/(dashboard)/courses/[id]/modules/[moduleId]/lessons/[lessonId]/page.tsx` -- 710-line lesson page with existing feedback UI at lines 599-655

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, everything verified in codebase
- Architecture: HIGH -- all integration points inspected, code examples based on actual source
- Pitfalls: HIGH -- derived from actual code inspection (auth mismatch, race conditions, validation edge cases)

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- no external dependencies changing)
