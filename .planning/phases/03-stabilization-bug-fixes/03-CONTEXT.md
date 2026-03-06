# Phase 3: Stabilization & Bug Fixes - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit and fix broken functionality across the entire platform. Core flows (auth, course generation/enrollment/progression, quizzes) must work reliably. The audit covers all user-facing flows plus security and data integrity issues cataloged in CONCERNS.md. This phase does NOT add new features — it stabilizes what exists.

</domain>

<decisions>
## Implementation Decisions

### Audit scope & approach
- Full platform audit — not limited to success criteria flows
- User-facing flows audited first: auth -> courses -> quizzes -> lessons -> file uploads -> notifications -> sharing -> account management
- Start from known CONCERNS.md issues as quick wins, then sweep remaining flows for new bugs
- Code review + test-driven discovery: read each flow's code, write integration tests, let failing tests reveal bugs
- No manual walkthrough — systematic code-level audit only

### Fix depth
- Enrollment: full refactor to separate Enrollment collection with compound index `{ course: 1, student: 1 }` — fixes race condition AND scaling concern
- ObjectId validation: shared `validateObjectId()` utility applied consistently across all routes that take ID params
- Quiz routes: split multiplexed `?action=start/submit` POST into separate `quiz/start/route.ts` and `quiz/submit/route.ts`
- Authorization: consolidate all inline isInstructor/isEnrolled/isAdmin checks into a shared `getCoursePermissions()` utility, building on Phase 2 ownership helpers
- Monolithic pages: decompose only when a bug lives in that page — don't restructure pages without bugs

### Soft-delete consistency
- Claude's Discretion — evaluate what makes sense based on how deletion actually works across the app (User has field but no filter; Module/Lesson have neither)

### File serving access control
- Claude's Discretion — evaluate actual risk based on how file paths are constructed (UUID component may be sufficient)

### Testing strategy
- Strict TDD for every fix: write a failing test first, then fix
- No limits on test count or execution time — correctness over speed
- Include queue worker and AI generation handler tests (zero coverage currently, high risk)
- Mock external APIs (AI providers, YouTube API) — test logic, not external services
- Use existing mongodb-memory-server pattern for integration tests

### Known issue priority
- Claude's Discretion on sequencing — determine most impactful order during audit
- Known bugs from CONCERNS.md are confirmed starting points, not the only targets
- Auth consolidation is a cleanup task that happens alongside bug fixes, not a separate effort

</decisions>

<specifics>
## Specific Ideas

- The enrollment refactor is the biggest structural change — touches many files that check `course.enrolledStudents`. Plan this carefully.
- Quiz route split should preserve the existing API contract for any frontend code already calling the quiz endpoint
- getCoursePermissions() should return a clear permissions object: `{ isInstructor, isEnrolled, isOwner, isAdmin, canEdit, canView }`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `checkCourseOwnership()` / `canModifyOwnedCourse()` / `canAccessOwnedCourse()` (`lib/auth/courseOwnership.ts`): Phase 2 ownership helpers — extend into getCoursePermissions()
- `authenticate()` from `lib/auth/middleware.ts`: JWT auth helper used by all routes
- `requireAuth` / `requireRole` HOF wrappers: Existing middleware pattern to build on
- `mongodb-memory-server` test setup in `__tests__/setup.ts`: Established integration test pattern
- `lib/utils/quizGrader.ts`: Has unit tests — good reference for quiz logic

### Established Patterns
- API routes: `authenticate() -> dbConnect() -> validate with Zod -> NextResponse.json()`
- Course ownership: `course.instructor` (creator) and `course.owner` (AI-generated) fields
- Soft-delete: `deletedAt` field + `pre(/^find/)` middleware on Course, Assignment, Submission
- Job queue: `lib/queue/` with handlers in `lib/queue/handlers/`, poll-based worker

### Integration Points
- `app/api/courses/[id]/enroll/route.ts`: Enrollment logic — needs refactor to Enrollment collection
- All routes under `app/api/courses/[id]/`: Authorization consolidation targets
- `app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts`: Quiz route split target
- `lib/models/`: Mongoose models — Enrollment model to be created, User model filter to be added
- `lib/queue/worker.ts` + `lib/queue/handlers/aiGeneration.ts`: Queue testing targets

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-stabilization-bug-fixes*
*Context gathered: 2026-03-06*
