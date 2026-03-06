---
phase: 04-public-catalog-sharing
plan: 01
subsystem: api, database, auth
tags: [mongoose, mongodb, accessLevel, catalog, permissions, enrollment, text-search]

requires:
  - phase: 03-stabilization-bug-fixes
    provides: getCoursePermissions, Enrollment model, coursePermissions pattern

provides:
  - accessLevel enum field (restricted/unlisted/published) on Course schema
  - enrolledCount denormalized counter on Course schema
  - isPublished virtual (backward-compatible)
  - getCoursePermissions with null user support for unauthenticated access
  - GET /api/courses?catalog=true catalog query mode
  - Atomic enrolledCount increment/decrement on enroll/unenroll

affects: [04-02, 04-03, public-catalog-ui, explore-page, course-detail-page]

tech-stack:
  added: []
  patterns:
    - "Three-tier access model: restricted < unlisted < published"
    - "Catalog query mode via ?catalog=true param with enrollment-count sorting"
    - "Null user permissions pattern for unauthenticated route access"
    - "isPublished virtual over accessLevel for backward compatibility"

key-files:
  created:
    - __tests__/integration/courses/accessLevel.test.ts
    - __tests__/integration/courses/catalog.test.ts
  modified:
    - lib/models/Course.ts
    - lib/auth/coursePermissions.ts
    - app/api/courses/route.ts
    - app/api/courses/[id]/route.ts
    - app/api/courses/[id]/enroll/route.ts
    - __tests__/helpers/fixtures.ts
    - __tests__/integration/courses/enrollment.test.ts
    - __tests__/integration/courses/authorization.test.ts
    - __tests__/integration/assignments/crud.test.ts
    - __tests__/integration/quiz/status.test.ts

key-decisions:
  - "isPublished becomes a Mongoose virtual over accessLevel for full backward compat"
  - "Published/unlisted courses viewable by any user (including unauthenticated) via null-user permissions"
  - "Catalog mode defaults to 12 per page (vs 10 for dashboard) sorted by enrolledCount desc"
  - "PATCH handler maps isPublished boolean to accessLevel to preserve existing API contract"
  - "Outsiders on published courses now get 200 (not 403) for view-only routes (assignments, quiz status)"

patterns-established:
  - "accessLevel field replaces isPublished for query filters; isPublished virtual for document reads"
  - "getCoursePermissions(course, null) for unauthenticated route handlers"
  - "catalog=true query param triggers public catalog mode on GET /api/courses"

requirements-completed: [CATL-01, CATL-02]

duration: 16min
completed: 2026-03-06
---

# Phase 04 Plan 01: Backend Catalog and Access Level Summary

**Three-tier course access model (restricted/unlisted/published) with catalog query mode, null-user permissions, and atomic enrollment counting**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-06T17:59:17Z
- **Completed:** 2026-03-06T18:15:57Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Course schema extended with accessLevel enum and enrolledCount denormalized counter
- getCoursePermissions supports null user for unauthenticated visitors
- GET /api/courses?catalog=true returns published courses sorted by popularity
- Authenticated catalog mode excludes user's own/enrolled courses
- All 394 tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add accessLevel field to Course schema and update permissions**
   - `c881959` (test: failing tests for accessLevel)
   - `1932d52` (feat: implementation + all tests passing)
2. **Task 2: Add catalog query mode to GET /api/courses**
   - `21ab01c` (test: failing tests for catalog query mode)
   - `a56a95d` (feat: implementation + all tests passing)
3. **Broader test adjustments** - `500071b` (fix: update outsider access expectations)

_Note: TDD tasks have RED (test) and GREEN (feat) commits._

## Files Created/Modified
- `lib/models/Course.ts` - Added accessLevel enum, enrolledCount, isPublished virtual
- `lib/auth/coursePermissions.ts` - Nullable user support, accessLevel-based canView
- `app/api/courses/route.ts` - Catalog mode with sorting, exclusion, pagination
- `app/api/courses/[id]/route.ts` - Updated to use getCoursePermissions with nullable user
- `app/api/courses/[id]/enroll/route.ts` - accessLevel check, atomic enrolledCount updates
- `__tests__/helpers/fixtures.ts` - accessLevel override support in createTestCourse
- `__tests__/integration/courses/accessLevel.test.ts` - 19 tests for access level behavior
- `__tests__/integration/courses/catalog.test.ts` - 11 tests for catalog query mode

## Decisions Made
- isPublished converted to Mongoose virtual over accessLevel for full backward compatibility with existing code that reads `course.isPublished`
- PATCH handler maps `isPublished: true/false` to `accessLevel: published/restricted` so existing API consumers continue working
- Published/unlisted courses are viewable by any user (including null/unauthenticated) -- this is the correct semantic for a public catalog
- Catalog mode defaults to 12 results per page (vs 10 for dashboard) sorted by enrolledCount descending
- Outsider access on published courses returns 200 for view-only routes (assignments list, quiz status) since published means publicly accessible

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated enrollment test error message expectation**
- **Found during:** Task 1
- **Issue:** Enrollment test expected "unpublished" in error message, but error now says "restricted"
- **Fix:** Updated test assertion from `toContain("unpublished")` to `toContain("restricted")`
- **Files modified:** `__tests__/integration/courses/enrollment.test.ts`
- **Committed in:** 1932d52

**2. [Rule 1 - Bug] Updated authorization test for published course outsider access**
- **Found during:** Task 1
- **Issue:** Authorization test expected 403 for outsider GET assignments on published course, but published courses are now viewable by any authenticated user
- **Fix:** Changed expectation from 403 to 200
- **Files modified:** `__tests__/integration/courses/authorization.test.ts`
- **Committed in:** 1932d52

**3. [Rule 3 - Blocking] Added cache invalidation in catalog tests**
- **Found during:** Task 2
- **Issue:** In-memory cache persisted between tests causing stale data in catalog test results
- **Fix:** Added `cache.invalidatePrefix("catalog:")` and `cache.invalidatePrefix("courses:")` to afterEach
- **Files modified:** `__tests__/integration/courses/catalog.test.ts`
- **Committed in:** a56a95d

**4. [Rule 3 - Blocking] Added ensureIndexes for text search in parallel tests**
- **Found during:** Task 2
- **Issue:** MongoDB text index not created when running catalog tests in parallel with other test files
- **Fix:** Added `Course.ensureIndexes()` to beforeAll
- **Files modified:** `__tests__/integration/courses/catalog.test.ts`
- **Committed in:** a56a95d

**5. [Rule 1 - Bug] Updated broader test suite for accessLevel behavior**
- **Found during:** Task 2 (verification)
- **Issue:** Assignment crud and quiz status tests expected 403 for outsiders on published courses
- **Fix:** Updated expectations to 200 since published courses are publicly viewable
- **Files modified:** `__tests__/integration/assignments/crud.test.ts`, `__tests__/integration/quiz/status.test.ts`
- **Committed in:** 500071b

---

**Total deviations:** 5 auto-fixed (3 bugs, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend foundation complete for public catalog UI (Plan 02)
- accessLevel field and catalog query ready for explore page
- getCoursePermissions with null user ready for public course detail page
- OG metadata (title, description, instructor.name) verified for public courses

## Self-Check: PASSED

All 9 files verified present. All 5 commits verified in git log.

---
*Phase: 04-public-catalog-sharing*
*Completed: 2026-03-06*
