---
phase: 03-stabilization-bug-fixes
plan: 04
subsystem: api
tags: [authorization, validation, mongoose, coursePermissions, validateObjectId]

# Dependency graph
requires:
  - phase: 03-01
    provides: getCoursePermissions utility and validateObjectId utility
  - phase: 03-02
    provides: Enrollment.isEnrolled as enrollment source of truth
provides:
  - Consistent authorization via getCoursePermissions across all 19 course + 3 AI route files
  - ObjectId validation at route entry for all course and AI routes
  - Cross-route authorization test suite (19 tests)
  - resolveId helper in coursePermissions for populated Mongoose references
affects: [04-public-catalog, all-course-routes, ai-routes]

# Tech tracking
tech-stack:
  added: []
  patterns: [getCoursePermissions-at-route-entry, validateObjectId-before-db-call, resolveId-for-populated-refs]

key-files:
  created:
    - __tests__/integration/courses/authorization.test.ts
  modified:
    - lib/auth/coursePermissions.ts
    - app/api/courses/[id]/route.ts
    - app/api/courses/[id]/modules/route.ts
    - app/api/courses/[id]/modules/[moduleId]/route.ts
    - app/api/courses/[id]/modules/[moduleId]/lessons/route.ts
    - app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/route.ts
    - app/api/courses/[id]/assignments/route.ts
    - app/api/courses/[id]/assignments/[assignmentId]/route.ts
    - app/api/courses/[id]/assignments/[assignmentId]/files/route.ts
    - app/api/courses/[id]/assignments/[assignmentId]/submissions/route.ts
    - app/api/courses/[id]/assignments/[assignmentId]/submissions/[submissionId]/route.ts
    - app/api/courses/[id]/share/route.ts
    - app/api/courses/[id]/gradebook/route.ts
    - app/api/courses/[id]/grades/route.ts
    - app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts
    - app/api/courses/[id]/assignments/[assignmentId]/quiz/start/route.ts
    - app/api/courses/[id]/assignments/[assignmentId]/quiz/submit/route.ts
    - app/api/ai/chat/route.ts
    - app/api/ai/generate/route.ts
    - app/api/ai/generate/[contentId]/route.ts

key-decisions:
  - "resolveId helper handles both populated and unpopulated Mongoose refs in getCoursePermissions"
  - "Quiz routes migrated from Enrollment.isEnrolled to perms.isEnrolled for consistency"
  - "AI routes use getCoursePermissions with canView for read and canEdit for write"

patterns-established:
  - "Every course/AI route handler starts with validateObjectId for all path params"
  - "Authorization via getCoursePermissions: canView for GET, canEdit for POST/PATCH/DELETE, isEnrolled for student actions"

requirements-completed: [BUGS-01]

# Metrics
duration: 15min
completed: 2026-03-07
---

# Phase 3 Plan 4: Authorization Consistency Summary

**Centralized authorization via getCoursePermissions and ObjectId validation across 22 API route files, replacing inline checks with consistent patterns**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-06T16:25:00Z
- **Completed:** 2026-03-06T16:40:00Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments
- Created cross-route authorization test suite with 19 tests covering ObjectId validation, instructor, student, outsider, and admin access patterns
- Replaced all inline isInstructor/isEnrolled/isAdmin/isAuthorized checks across 19 course routes and 3 AI routes with getCoursePermissions()
- Added validateObjectId() at route entry for all path parameters (courseId, moduleId, lessonId, assignmentId, submissionId, contentId)
- Fixed getCoursePermissions to handle populated Mongoose references via resolveId helper

## Task Commits

Each task was committed atomically:

1. **Task 1: Create authorization consistency tests** - `b34585b` (test)
2. **Task 2: Apply getCoursePermissions and validateObjectId across all routes** - `1e363a9` (feat)

## Files Created/Modified
- `__tests__/integration/courses/authorization.test.ts` - 19 cross-route authorization consistency tests
- `lib/auth/coursePermissions.ts` - Added resolveId helper for populated Mongoose refs
- `app/api/courses/[id]/route.ts` - Replaced inline auth with getCoursePermissions, added validateObjectId
- `app/api/courses/[id]/modules/route.ts` - Same migration
- `app/api/courses/[id]/modules/[moduleId]/route.ts` - Same migration
- `app/api/courses/[id]/modules/[moduleId]/lessons/route.ts` - Same migration
- `app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/route.ts` - Same migration
- `app/api/courses/[id]/assignments/route.ts` - Same migration
- `app/api/courses/[id]/assignments/[assignmentId]/route.ts` - Same migration
- `app/api/courses/[id]/assignments/[assignmentId]/files/route.ts` - Same migration
- `app/api/courses/[id]/assignments/[assignmentId]/submissions/route.ts` - Same migration
- `app/api/courses/[id]/assignments/[assignmentId]/submissions/[submissionId]/route.ts` - Same migration
- `app/api/courses/[id]/share/route.ts` - Same migration
- `app/api/courses/[id]/gradebook/route.ts` - Same migration
- `app/api/courses/[id]/grades/route.ts` - Same migration
- `app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts` - Same migration
- `app/api/courses/[id]/assignments/[assignmentId]/quiz/start/route.ts` - Same migration
- `app/api/courses/[id]/assignments/[assignmentId]/quiz/submit/route.ts` - Same migration
- `app/api/ai/chat/route.ts` - Same migration
- `app/api/ai/generate/route.ts` - Same migration
- `app/api/ai/generate/[contentId]/route.ts` - Same migration

## Decisions Made
- Added resolveId() helper to getCoursePermissions to handle both populated and unpopulated Mongoose references. When course.instructor is populated via .populate(), .toString() returns [object Object] instead of the ID string. resolveId checks for _id property on populated objects.
- Quiz routes migrated from direct Enrollment.isEnrolled() calls to perms.isEnrolled for consistency, since getCoursePermissions already calls Enrollment.isEnrolled internally.
- AI routes use getCoursePermissions with canView for chat (any course participant can chat) and canEdit for content generation/approval (only instructor/admin).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed populated Mongoose reference handling in getCoursePermissions**
- **Found during:** Task 2 (route migration)
- **Issue:** When course.instructor is populated via .populate("instructor", "name email"), calling .toString() returns "[object Object]" instead of the ObjectId string, causing isInstructor to always be false
- **Fix:** Added resolveId() helper that checks if field has _id property (populated) and extracts it, falling back to String(field) for unpopulated refs
- **Files modified:** lib/auth/coursePermissions.ts
- **Verification:** courses/crud.test.ts "returns a course by ID" test passes (previously failing with canEdit: false)
- **Committed in:** 1e363a9 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added validateObjectId to quiz routes**
- **Found during:** Task 2 (route migration)
- **Issue:** Quiz routes (quiz/route.ts, quiz/start/route.ts, quiz/submit/route.ts) were not listed in the plan's file list but had inline auth patterns that needed migration
- **Fix:** Added getCoursePermissions and validateObjectId to all 3 quiz route files
- **Files modified:** quiz/route.ts, quiz/start/route.ts, quiz/submit/route.ts
- **Verification:** Quiz tests (start, status, submit) all pass
- **Committed in:** 1e363a9 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. The populated ref bug would have broken permission checks on any route that populates instructor. The quiz routes were an oversight in the plan scope.

## Issues Encountered
- ESLint auto-fix repeatedly reverted getCoursePermissions and validateObjectId imports when using the Write tool, because the linter detected "unused imports" and removed them before the file body changes could be evaluated. Resolved by writing files via bash heredoc instead of the Write tool.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All course and AI API routes now use consistent authorization patterns
- getCoursePermissions is the single source of truth for all permission checks
- validateObjectId prevents CastError 500s on all route entry points
- Ready for Phase 4 (public catalog) which will need to handle unauthenticated access patterns

## Self-Check: PASSED

- All key files exist (authorization.test.ts, coursePermissions.ts, all route files)
- Both commits verified (b34585b, 1e363a9)
- Zero remaining inline auth patterns in app/api/courses/ and app/api/ai/
- 19/19 authorization tests pass
- 16/16 courses/crud tests pass

---
*Phase: 03-stabilization-bug-fixes*
*Completed: 2026-03-07*
