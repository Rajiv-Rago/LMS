---
phase: 03-stabilization-bug-fixes
plan: 03
subsystem: api
tags: [quiz, rest, tdd, route-splitting, enrollment]

requires:
  - phase: 03-01
    provides: validateObjectId, getCoursePermissions, Enrollment.isEnrolled
provides:
  - POST /quiz/start route for starting quiz attempts
  - POST /quiz/submit route for submitting quiz answers
  - 410 Gone deprecation on old multiplexed POST /quiz
  - Integration tests for quiz start, submit, and status flows
affects: [quiz-ui, assignments, grading]

tech-stack:
  added: []
  patterns: [split-route-with-deprecation, enrollment-collection-check]

key-files:
  created:
    - app/api/courses/[id]/assignments/[assignmentId]/quiz/start/route.ts
    - app/api/courses/[id]/assignments/[assignmentId]/quiz/submit/route.ts
    - __tests__/integration/quiz/start.test.ts
    - __tests__/integration/quiz/submit.test.ts
    - __tests__/integration/quiz/status.test.ts
  modified:
    - app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts
    - app/(dashboard)/courses/[id]/assignments/[assignmentId]/quiz/page.tsx

key-decisions:
  - "Enrollment check via Enrollment.isEnrolled in all quiz routes (not enrolledStudents array)"
  - "Old POST /quiz returns 410 Gone instead of being removed, for cached frontend safety"

patterns-established:
  - "Route deprecation: return 410 Gone with migration message when splitting endpoints"

requirements-completed: [BUGS-01]

duration: 5min
completed: 2026-03-06
---

# Phase 3 Plan 3: Quiz Route Split Summary

**Split multiplexed POST /quiz into /quiz/start and /quiz/submit with TDD integration tests covering auth, enrollment, time limits, and grading**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T16:02:20Z
- **Completed:** 2026-03-06T16:08:17Z
- **Tasks:** 2 (Task 1 TDD: 3 test files + 2 route files, Task 2: frontend update)
- **Files modified:** 7

## Accomplishments
- Split 387-line multiplexed POST handler into two focused route files (start: 148 lines, submit: 147 lines)
- Created 26 integration tests across 3 test files covering quiz start, submit, and status flows
- Updated frontend quiz page to call new /quiz/start and /quiz/submit endpoints
- Deprecated old POST /quiz with 410 Gone for backwards compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Quiz tests** - `7c58fda` (test)
2. **Task 1 (GREEN): Quiz start/submit routes** - `1fdc5d3` (feat)
3. **Task 2: Frontend quiz page update** - `0978a69` (feat)

## Files Created/Modified
- `app/api/courses/[id]/assignments/[assignmentId]/quiz/start/route.ts` - Quiz start endpoint with enrollment, validation, attempt management
- `app/api/courses/[id]/assignments/[assignmentId]/quiz/submit/route.ts` - Quiz submit endpoint with grading, time enforcement, score tracking
- `app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts` - POST deprecated to 410 Gone, GET unchanged
- `app/(dashboard)/courses/[id]/assignments/[assignmentId]/quiz/page.tsx` - Updated fetch URLs to new routes
- `__tests__/integration/quiz/start.test.ts` - 11 tests for quiz start flow
- `__tests__/integration/quiz/submit.test.ts` - 8 tests for quiz submit flow
- `__tests__/integration/quiz/status.test.ts` - 7 tests for quiz status (GET) flow

## Decisions Made
- Used `Enrollment.isEnrolled()` in all quiz routes (start, submit, GET status) instead of `enrolledStudents` array, consistent with Plan 01 enrollment migration
- Kept old POST /quiz with 410 Gone response rather than removing it, so any cached frontend code gets a clear migration error

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed GET /quiz enrollment check to use Enrollment collection**
- **Found during:** Task 1 (status tests)
- **Issue:** GET handler still used `course.enrolledStudents.some()` which doesn't match `createTestEnrollment()` fixtures that write to Enrollment collection
- **Fix:** Switched to `Enrollment.isEnrolled(course._id, user.userId)` and added Enrollment import
- **Files modified:** app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts
- **Verification:** All 7 status tests pass
- **Committed in:** 1fdc5d3

**2. [Rule 1 - Bug] Fixed hasActiveAttempt returning undefined instead of false**
- **Found during:** Task 1 (status tests)
- **Issue:** `lastAttempt && !lastAttempt.completedAt` returned `undefined` when no attempts exist, not `false`
- **Fix:** Wrapped in `!!()` to coerce to boolean
- **Files modified:** app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts
- **Verification:** Status test for "no active attempt" passes with strict `toBe(false)`
- **Committed in:** 1fdc5d3

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Quiz routes are split and tested; future quiz features can be added to dedicated route files
- Frontend updated; no legacy ?action= query params remain

---
*Phase: 03-stabilization-bug-fixes*
*Completed: 2026-03-06*
