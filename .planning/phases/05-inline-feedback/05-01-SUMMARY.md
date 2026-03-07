---
phase: 05-inline-feedback
plan: 01
subsystem: api
tags: [mongoose, jwt, rate-limiting, versioning, authorization]

requires:
  - phase: 03-stabilization-bug-fixes
    provides: getCoursePermissions with isSharedWith flag
provides:
  - previousContent and previousKeyTakeaways fields on Lesson model
  - Revert endpoint (POST /api/courses/ai/[courseId]/lessons/[lessonId]/revert)
  - Credits endpoint (GET /api/ai/credits)
  - getAICreditsRemaining read-only function
  - Expanded generate route auth to sharedWith users
affects: [05-02, 05-03, inline-feedback-ui]

tech-stack:
  added: []
  patterns: [content versioning via previousContent swap, getCoursePermissions canEdit||isSharedWith auth pattern]

key-files:
  created:
    - app/api/courses/ai/[courseId]/lessons/[lessonId]/revert/route.ts
    - app/api/ai/credits/route.ts
    - __tests__/integration/courses/lessonFeedback.test.ts
    - __tests__/integration/courses/lessonRevert.test.ts
  modified:
    - lib/models/Lesson.ts
    - lib/ai/rateLimit.ts
    - lib/queue/handlers/aiGeneration.ts
    - app/api/courses/ai/[courseId]/lessons/[lessonId]/generate/route.ts
    - app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/route.ts

key-decisions:
  - "Revert clears previousContent after swap (single-level undo, not multi-level)"
  - "Credits endpoint returns null for Infinity values (JSON-safe serialization)"
  - "Queue handler uses $or query for owner/instructor/sharedWith instead of getCoursePermissions (avoids JWTPayload dependency in queue context)"

patterns-established:
  - "Content versioning: save to previousContent before overwrite, clear on revert"
  - "Auth expansion: getCoursePermissions canEdit || isSharedWith for AI routes"

requirements-completed: [FDBK-02, FDBK-03, FDBK-05]

duration: 4min
completed: 2026-03-07
---

# Phase 5 Plan 01: Backend Foundation for Inline Feedback Summary

**Content versioning with previousContent swap, expanded auth for sharedWith users, revert and credits endpoints with full integration tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T07:11:16Z
- **Completed:** 2026-03-07T07:15:55Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Lesson model extended with previousContent and previousKeyTakeaways for single-level content versioning
- Generate route and queue handler now accept sharedWith users alongside owners and instructors
- Revert endpoint atomically swaps content/previousContent and clears the previous version
- Credits endpoint returns remaining daily AI credits without consuming any
- 14 integration tests covering all auth paths, edge cases, and both new endpoints

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: Content versioning + auth expansion** - `cf461c2` (test), `635d31f` (feat)
2. **Task 2: Revert + credits endpoints** - `c4d1644` (test), `23704af` (feat)

## Files Created/Modified
- `lib/models/Lesson.ts` - Added previousContent and previousKeyTakeaways fields
- `lib/ai/rateLimit.ts` - Added getAICreditsRemaining read-only function
- `lib/queue/handlers/aiGeneration.ts` - Expanded auth to $or query, saves previousContent before overwrite
- `app/api/courses/ai/[courseId]/lessons/[lessonId]/generate/route.ts` - Uses getCoursePermissions for canEdit||isSharedWith
- `app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/route.ts` - Returns isSharedWith in permissions
- `app/api/courses/ai/[courseId]/lessons/[lessonId]/revert/route.ts` - New POST endpoint for content revert
- `app/api/ai/credits/route.ts` - New GET endpoint for remaining credits
- `__tests__/integration/courses/lessonFeedback.test.ts` - 6 integration tests for auth expansion
- `__tests__/integration/courses/lessonRevert.test.ts` - 8 integration tests for revert and credits

## Decisions Made
- Revert clears previousContent after swap -- single-level undo, not multi-level history
- Credits endpoint serializes Infinity as null for JSON safety
- Queue handler uses MongoDB $or query instead of getCoursePermissions to avoid JWTPayload dependency in background job context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend foundation complete for inline feedback UI
- Revert and credits endpoints ready for frontend consumption
- Content versioning in place for regeneration workflows

## Self-Check: PASSED

All 10 files verified present. All 4 commits verified in git log.

---
*Phase: 05-inline-feedback*
*Completed: 2026-03-07*
