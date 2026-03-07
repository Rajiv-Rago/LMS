---
phase: 03-stabilization-bug-fixes
plan: 01
subsystem: auth, database, testing
tags: [mongoose, objectid-validation, enrollment, course-permissions, tdd]

requires:
  - phase: 02-role-simplification
    provides: Course ownership helpers (courseOwnership.ts) extended into getCoursePermissions

provides:
  - validateObjectId shared utility for consistent 400 responses
  - Enrollment Mongoose model with compound unique index
  - getCoursePermissions centralized authorization utility
  - createTestEnrollment and createTestQuizAssignment test fixtures

affects: [03-02 enrollment-migration, 03-03 quiz-route-split, 03-04 auth-consolidation, 03-05 route-audit]

tech-stack:
  added: []
  patterns: [Enrollment collection replaces enrolledStudents array for isEnrolled checks, centralized permission flags via getCoursePermissions]

key-files:
  created:
    - lib/utils/validateObjectId.ts
    - lib/models/Enrollment.ts
    - lib/auth/coursePermissions.ts
    - lib/utils/validateObjectId.test.ts
    - lib/models/Enrollment.test.ts
    - lib/auth/coursePermissions.test.ts
  modified:
    - lib/models/index.ts
    - __tests__/helpers/fixtures.ts

key-decisions:
  - "Enrollment.isEnrolled queries Enrollment collection, not course.enrolledStudents array -- establishes new source of truth"
  - "getCoursePermissions takes pre-fetched ICourse document to avoid redundant DB lookups"
  - "CoursePermissions interface adds isSharedWith and derived canEdit/canView flags beyond existing CourseOwnershipResult"

patterns-established:
  - "validateObjectId returns null | NextResponse for use as early-return guard in route handlers"
  - "Enrollment statics (isEnrolled, getEnrollmentCount) encapsulate common queries"
  - "getCoursePermissions derives canEdit/canView from role flags for single authorization call"

requirements-completed: [BUGS-01]

duration: 3min
completed: 2026-03-06
---

# Phase 03 Plan 01: Foundational Utilities Summary

**validateObjectId, Enrollment model with compound unique index, and getCoursePermissions centralized authorization -- all TDD with 23 new tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T15:56:01Z
- **Completed:** 2026-03-06T15:59:45Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- validateObjectId utility returns 400 NextResponse for invalid ObjectIds, null for valid ones
- Enrollment model with compound unique `{course, student}` index, isEnrolled/getEnrollmentCount statics
- getCoursePermissions returns permission flags for all 6 user types (instructor, owner, enrolled, admin, shared, outsider)
- Test fixtures extended with createTestEnrollment and createTestQuizAssignment helpers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create validateObjectId, Enrollment model, and getCoursePermissions** - `10426a3` (test) + `d8f410d` (feat)
2. **Task 2: Extend test fixtures** - `4a79d2a` (feat)

_TDD task had separate RED and GREEN commits._

## Files Created/Modified
- `lib/utils/validateObjectId.ts` - Shared ObjectId validation returning null | NextResponse
- `lib/utils/validateObjectId.test.ts` - 5 unit tests
- `lib/models/Enrollment.ts` - Enrollment collection model with compound unique index and statics
- `lib/models/Enrollment.test.ts` - 10 integration tests
- `lib/auth/coursePermissions.ts` - Centralized getCoursePermissions with 7 boolean flags
- `lib/auth/coursePermissions.test.ts` - 8 integration tests covering all user types
- `lib/models/index.ts` - Added Enrollment barrel export
- `__tests__/helpers/fixtures.ts` - Added createTestEnrollment and createTestQuizAssignment

## Decisions Made
- Enrollment.isEnrolled queries the new Enrollment collection, not course.enrolledStudents -- this establishes the new source of truth before migration
- getCoursePermissions takes a pre-fetched ICourse to avoid duplicate DB lookups
- CoursePermissions interface adds isSharedWith and derived canEdit/canView beyond the existing CourseOwnershipResult

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three foundational utilities ready for Plans 02-05 to consume
- Enrollment model established; Plan 02 can now migrate enrolledStudents array data
- getCoursePermissions ready for route-level authorization consolidation in Plans 04-05

## Self-Check: PASSED

All 8 files verified present. All 3 commits (10426a3, d8f410d, 4a79d2a) verified in git log. 285/285 tests pass.

---
*Phase: 03-stabilization-bug-fixes*
*Completed: 2026-03-06*
