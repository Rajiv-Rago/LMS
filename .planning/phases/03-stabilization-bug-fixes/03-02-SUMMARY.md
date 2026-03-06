---
phase: 03-stabilization-bug-fixes
plan: 02
subsystem: database, api
tags: [mongodb, enrollment, race-condition, compound-index, mongoose]

requires:
  - phase: 03-stabilization-bug-fixes/01
    provides: Enrollment model with compound unique index, validateObjectId, getCoursePermissions
provides:
  - All 16 API routes migrated from enrolledStudents array to Enrollment collection
  - Race-condition-free enrollment via compound unique index
  - Enrollment collection as single source of truth for student enrollment
affects: [03-stabilization-bug-fixes/03, 03-stabilization-bug-fixes/04, 03-stabilization-bug-fixes/05]

tech-stack:
  added: []
  patterns: [Enrollment.isEnrolled() for auth checks, Enrollment.find().distinct() for course listings, E11000 catch for atomic duplicate prevention]

key-files:
  created: []
  modified:
    - app/api/courses/[id]/enroll/route.ts
    - app/api/courses/route.ts
    - app/api/courses/[id]/route.ts
    - app/api/courses/[id]/assignments/route.ts
    - app/api/courses/[id]/assignments/[assignmentId]/route.ts
    - app/api/courses/[id]/assignments/[assignmentId]/files/route.ts
    - app/api/courses/[id]/assignments/[assignmentId]/submissions/route.ts
    - app/api/courses/[id]/modules/route.ts
    - app/api/courses/[id]/grades/route.ts
    - app/api/courses/[id]/gradebook/route.ts
    - app/api/ai/chat/route.ts
    - app/api/ai/generate/route.ts
    - app/api/ai/generate/[contentId]/route.ts
    - lib/auth/courseOwnership.ts
    - app/api/users/me/delete/route.ts
    - app/api/users/me/export/route.ts
    - lib/models/Course.ts
    - __tests__/integration/courses/enrollment.test.ts
    - __tests__/integration/assignments/crud.test.ts
    - __tests__/integration/assignments/submissions.test.ts

key-decisions:
  - "E11000 catch pattern for atomic enrollment: try Enrollment.create(), catch duplicate key error, return 400"
  - "Gradebook student enumeration via Enrollment.find().populate('student') instead of Course.enrolledStudents populate"
  - "User data export uses Enrollment.find().distinct('course') to get enrolled course IDs"
  - "Account deletion uses Enrollment.deleteMany() instead of Course.$pull"
  - "Course.enrolledStudents field kept but marked DEPRECATED for data migration compatibility"

patterns-established:
  - "Enrollment auth pattern: await Enrollment.isEnrolled(courseId, userId) replaces course.enrolledStudents.some()"
  - "Enrollment listing pattern: Enrollment.find({student}).distinct('course') replaces {enrolledStudents: userId} query"

requirements-completed: [BUGS-01]

duration: 9min
completed: 2026-03-06
---

# Phase 3 Plan 2: Enrollment Migration Summary

**Migrated all 16 files from enrolledStudents array to Enrollment collection, eliminating TOCTOU race condition via compound unique index**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-06T16:02:22Z
- **Completed:** 2026-03-06T16:11:44Z
- **Tasks:** 2 (Task 1 was TDD with 2 commits)
- **Files modified:** 20

## Accomplishments
- Enrollment POST/DELETE route fully rewritten to use Enrollment.create() and Enrollment.deleteOne()
- All 16 API routes migrated from enrolledStudents array to Enrollment collection queries
- Race condition eliminated: compound unique index prevents duplicate enrollment at database level
- Enrollment integration tests rewritten to verify Enrollment documents, including concurrent enrollment test
- Test fixtures updated across assignment and submission tests to use createTestEnrollment

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Enrollment tests** - `193c9d2` (test)
2. **Task 1 (GREEN): Enrollment route** - `9665149` (feat)
3. **Task 2: Migrate remaining 14 files** - `85cdc98` (feat)

## Files Created/Modified
- `app/api/courses/[id]/enroll/route.ts` - Enrollment.create() + E11000 catch for POST, Enrollment.deleteOne() for DELETE
- `app/api/courses/route.ts` - Enrollment.find().distinct() for enrolled course listing
- `app/api/courses/[id]/route.ts` - Enrollment.isEnrolled() + getEnrollmentCount() for course detail
- `app/api/courses/[id]/assignments/route.ts` - Enrollment.isEnrolled() for auth
- `app/api/courses/[id]/assignments/[assignmentId]/route.ts` - Enrollment.isEnrolled() for auth
- `app/api/courses/[id]/assignments/[assignmentId]/files/route.ts` - Enrollment.isEnrolled() for auth (3 handlers)
- `app/api/courses/[id]/assignments/[assignmentId]/submissions/route.ts` - Enrollment.isEnrolled() for submit auth
- `app/api/courses/[id]/modules/route.ts` - Enrollment.isEnrolled() for auth
- `app/api/courses/[id]/grades/route.ts` - Enrollment.isEnrolled() for student grades auth
- `app/api/courses/[id]/gradebook/route.ts` - Enrollment.find().populate() for student enumeration
- `app/api/ai/chat/route.ts` - Enrollment.isEnrolled() for chat access
- `app/api/ai/generate/route.ts` - Enrollment.isEnrolled() for content listing auth
- `app/api/ai/generate/[contentId]/route.ts` - Enrollment.isEnrolled() for content detail auth
- `lib/auth/courseOwnership.ts` - Enrollment.isEnrolled() replacing enrolledStudents.some()
- `app/api/users/me/delete/route.ts` - Enrollment.deleteMany() replacing Course.$pull
- `app/api/users/me/export/route.ts` - Enrollment.find().distinct() for export data
- `lib/models/Course.ts` - enrolledStudents field marked DEPRECATED
- `__tests__/integration/courses/enrollment.test.ts` - Rewritten with Enrollment document verification
- `__tests__/integration/assignments/crud.test.ts` - Updated to use createTestEnrollment
- `__tests__/integration/assignments/submissions.test.ts` - Updated to use createTestEnrollment

## Decisions Made
- Used try/catch on Enrollment.create() with E11000 catch for atomic duplicate prevention (preferred over exists() check + create)
- Gradebook uses Enrollment.find().populate('student') with pagination instead of Course.enrolledStudents populate
- User data export queries Enrollment.find().distinct('course') for enrolled course IDs
- Account deletion uses Enrollment.deleteMany() instead of Course.updateMany with $pull
- Kept enrolledStudents field in schema (DEPRECATED) for backward compatibility with existing data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated assignment/submission test fixtures to use Enrollment collection**
- **Found during:** Task 2 (verification)
- **Issue:** Existing tests in crud.test.ts and submissions.test.ts used `Course.findByIdAndUpdate({$push: {enrolledStudents}})` to set up enrollment, but routes now check Enrollment collection
- **Fix:** Replaced inline enrollment setup with `createTestEnrollment()` fixture calls
- **Files modified:** __tests__/integration/assignments/crud.test.ts, __tests__/integration/assignments/submissions.test.ts
- **Verification:** All 9 previously failing tests now pass
- **Committed in:** 85cdc98 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed flaky Enrollment.test.ts unique index test**
- **Found during:** Task 2 (verification)
- **Issue:** "prevents duplicate enrollment" test failed in full suite due to index not being synced across test boundaries
- **Fix:** Added `await Enrollment.syncIndexes()` before duplicate test
- **Files modified:** lib/models/Enrollment.test.ts
- **Verification:** Test passes in both isolated and full suite runs
- **Committed in:** 85cdc98 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for test correctness after migration. No scope creep.

## Deferred Issues

**Submission.test.ts unique index flakiness** - Same index sync issue as Enrollment.test.ts but in the Submission model. Pre-existing, unrelated to enrollment migration. See `deferred-items.md`.

## Issues Encountered
None beyond the test fixture updates documented as deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Enrollment collection is now the single source of truth
- All routes query Enrollment collection for enrollment status
- Ready for Plan 03-03 (quiz route split) which depends on this migration
- Course.enrolledStudents field retained but deprecated for data migration

---
*Phase: 03-stabilization-bug-fixes*
*Completed: 2026-03-06*
