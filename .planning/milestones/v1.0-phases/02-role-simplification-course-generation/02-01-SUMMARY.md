---
phase: 02-role-simplification-course-generation
plan: 01
subsystem: auth, api
tags: [authorization, ownership, registration, role-removal, mongodb]

requires:
  - phase: 01-dark-mode
    provides: stable UI foundation
provides:
  - Ownership-based authorization replacing teacher role gates
  - Registration without role selection (always student)
  - Admin-only manual course creation
  - Owner checks on all instructor-gated API routes
affects: [02-02, 02-03, phase-03]

tech-stack:
  added: []
  patterns:
    - "isAuthorized pattern: instructor || owner || admin for write operations"
    - "isInstructor includes owner check for read access conditional data"
    - "Unified GET /api/courses query regardless of user role"

key-files:
  created:
    - __tests__/integration/courses/authorization.test.ts
  modified:
    - lib/validation/authSchemas.ts
    - app/api/auth/register/route.ts
    - app/(auth)/register/page.tsx
    - app/api/courses/route.ts
    - app/api/ai/generate/route.ts
    - app/api/courses/[id]/route.ts
    - app/api/courses/[id]/modules/route.ts
    - app/api/courses/[id]/modules/[moduleId]/route.ts
    - app/api/courses/[id]/modules/[moduleId]/lessons/route.ts
    - app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/route.ts
    - app/api/courses/[id]/assignments/route.ts
    - app/api/courses/[id]/assignments/[assignmentId]/route.ts
    - __tests__/integration/auth/register.test.ts
    - __tests__/integration/courses/crud.test.ts

key-decisions:
  - "Unified GET /api/courses query for all roles instead of role-based branching"
  - "POST /api/courses restricted to admin-only; teachers no longer create courses manually"
  - "AI generate POST removes role gate entirely; authorization via course ownership check"

patterns-established:
  - "isAuthorized pattern: course.instructor || course.owner || admin for write operations"
  - "isInstructor extended to include owner for read-level conditional access"

requirements-completed: [ROLE-01, ROLE-02, ROLE-04, ROLE-05]

duration: 6min
completed: 2026-03-06
---

# Phase 2 Plan 1: Role Simplification Summary

**Removed teacher role gates from registration and all API routes, replacing with ownership-based authorization (instructor OR owner OR admin)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-06T02:47:41Z
- **Completed:** 2026-03-06T02:53:20Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Registration schema and UI no longer include role selection; all new users are students
- All 15 instructor-gated API route handlers now also accept course owner
- POST /api/courses restricted to admin-only (was teacher+admin)
- AI content generation endpoint removes role gate; uses course ownership for authorization
- Authorization test suite covers owner, instructor, admin, and unauthorized access patterns
- Full test suite passes: 245 tests, 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove role from registration and refactor explicit teacher role checks** - `79bede2` (feat)
2. **Task 2: Add owner checks to instructor-based API routes and create authorization tests** - `f07465f` (feat)

## Files Created/Modified
- `lib/validation/authSchemas.ts` - Removed role field from registerSchema
- `app/api/auth/register/route.ts` - Hardcoded student role for new registrations
- `app/(auth)/register/page.tsx` - Removed role dropdown from registration form
- `app/api/courses/route.ts` - Admin-only POST, unified GET query for all roles
- `app/api/ai/generate/route.ts` - Removed role gate from POST, added owner to auth checks
- `app/api/courses/[id]/route.ts` - Added owner to PATCH/DELETE auth and GET isInstructor
- `app/api/courses/[id]/modules/route.ts` - Added owner to POST auth and GET isInstructor
- `app/api/courses/[id]/modules/[moduleId]/route.ts` - Added owner to PATCH/DELETE auth and GET isInstructor
- `app/api/courses/[id]/modules/[moduleId]/lessons/route.ts` - Added owner to POST auth and GET isInstructor
- `app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/route.ts` - Added owner to PATCH/DELETE auth and GET isInstructor
- `app/api/courses/[id]/assignments/route.ts` - Added owner to POST auth and GET isInstructor
- `app/api/courses/[id]/assignments/[assignmentId]/route.ts` - Added owner to PATCH/DELETE auth and GET isInstructor
- `__tests__/integration/courses/authorization.test.ts` - New ownership-based authorization tests
- `__tests__/integration/auth/register.test.ts` - Updated to test role field is ignored
- `__tests__/integration/courses/crud.test.ts` - Updated to test admin-only course creation
- `jest.setup.ts` - Fixed JWT_SECRET test value to meet 32-char minimum

## Decisions Made
- Unified GET /api/courses query for all authenticated non-admin users instead of separate teacher/student branches
- POST /api/courses restricted to admin-only; manual course creation by teachers removed since generation flow will handle course creation
- AI generate POST removes role gate entirely; the existing course ownership check provides sufficient authorization

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed JWT_SECRET test value length**
- **Found during:** Task 1 (test verification)
- **Issue:** jest.setup.ts set JWT_SECRET to 'test-jwt-secret-for-jest' (26 chars) but env validation requires 32+
- **Fix:** Extended test secret to 'test-jwt-secret-for-jest-runner-32' (34 chars)
- **Files modified:** jest.setup.ts
- **Verification:** All tests run successfully
- **Committed in:** 79bede2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix necessary for test execution. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ownership-based authorization in place for all course routes
- Registration simplified -- ready for unified generation flow (Plan 02)
- All existing teacher accounts still manage courses via instructor check
- Full test suite green with comprehensive authorization coverage

## Self-Check: PASSED

All 14 key files verified present. Both task commits (79bede2, f07465f) verified in git log.

---
*Phase: 02-role-simplification-course-generation*
*Completed: 2026-03-06*
