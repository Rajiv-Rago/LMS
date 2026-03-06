# Phase 3: Stabilization & Bug Fixes - Research

**Researched:** 2026-03-06
**Domain:** Full-stack bug fixing, test infrastructure, Mongoose schema refactoring, authorization consolidation
**Confidence:** HIGH

## Summary

Phase 3 is a stabilization phase covering audit, bug fixes, and structural refactors across the entire Kantigo platform. The codebase has 50+ API routes, 23 existing test files, and well-documented known issues in CONCERNS.md. The three biggest structural changes are: (1) enrollment refactor from Course.enrolledStudents array to a separate Enrollment collection, (2) quiz route split from multiplexed POST to separate start/submit routes, and (3) authorization consolidation from inline checks to a shared getCoursePermissions() utility.

The existing test infrastructure is solid: mongodb-memory-server for integration tests, direct route handler invocation via buildRequest/parseResponse helpers, fixture factories for users/courses/modules/assignments, and a mock AI provider. The pattern is well-established and can be extended to cover all uncovered routes. Zero test coverage exists for quiz routes, queue workers, file upload/download, notifications, sharing, gradebook, and account management.

**Primary recommendation:** Work in layers -- first create shared utilities (validateObjectId, getCoursePermissions, Enrollment model), then fix individual routes using TDD against those utilities, and finally verify the enrollment refactor propagates correctly across all dependent routes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full platform audit -- not limited to success criteria flows
- User-facing flows audited first: auth -> courses -> quizzes -> lessons -> file uploads -> notifications -> sharing -> account management
- Start from known CONCERNS.md issues as quick wins, then sweep remaining flows for new bugs
- Code review + test-driven discovery: read each flow's code, write integration tests, let failing tests reveal bugs
- No manual walkthrough -- systematic code-level audit only
- Enrollment: full refactor to separate Enrollment collection with compound index `{ course: 1, student: 1 }`
- ObjectId validation: shared `validateObjectId()` utility applied consistently across all routes that take ID params
- Quiz routes: split multiplexed `?action=start/submit` POST into separate `quiz/start/route.ts` and `quiz/submit/route.ts`
- Authorization: consolidate all inline isInstructor/isEnrolled/isAdmin checks into a shared `getCoursePermissions()` utility, building on Phase 2 ownership helpers
- Monolithic pages: decompose only when a bug lives in that page -- don't restructure pages without bugs
- Strict TDD for every fix: write a failing test first, then fix
- No limits on test count or execution time -- correctness over speed
- Include queue worker and AI generation handler tests (zero coverage currently, high risk)
- Mock external APIs (AI providers, YouTube API) -- test logic, not external services
- Use existing mongodb-memory-server pattern for integration tests
- Auth consolidation is a cleanup task that happens alongside bug fixes, not a separate effort

### Claude's Discretion
- Soft-delete consistency: evaluate what makes sense based on how deletion actually works across the app (User has field but no filter; Module/Lesson have neither)
- File serving access control: evaluate actual risk based on how file paths are constructed (UUID component may be sufficient)
- Known issue priority/sequencing: determine most impactful order during audit

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUGS-01 | Identify and fix broken functionality across core flows (auth, courses, lessons, quizzes, AI generation) | Full codebase audit complete. CONCERNS.md catalogs 6 known bugs/tech debt items, 4 security considerations, 4 performance concerns, 5 fragile areas, and 7 test coverage gaps. Research identifies all files requiring changes, authorization patterns needing consolidation, and enrollment refactor scope. |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Jest | 30.2.0 | Test runner | Already configured with `jest.config.ts`, `jest.setup.ts` |
| mongodb-memory-server | 11.0.1 | In-memory MongoDB for tests | Already used in `__tests__/helpers/db.ts` |
| Mongoose | 8.19.2 | MongoDB ODM | Core data layer, all models use it |
| Zod | 4.3.6 | Request validation | Already used across all API routes |
| Next.js | 16.1.6 | Framework | Route handlers, App Router |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| bcryptjs | 3.0.3 | Password hashing | Auth tests needing user creation |
| jsonwebtoken | 9.0.3 | JWT tokens | Auth flow testing |

### No New Dependencies Needed
This phase requires no new libraries. All work uses existing stack. Test helpers (`buildRequest`, `parseResponse`, `createTestUser`, etc.) are already established.

## Architecture Patterns

### Existing Test Structure (Extend This)
```
__tests__/
  helpers/
    api.ts          # buildRequest(), parseResponse()
    db.ts           # connectTestDb(), clearTestDb(), disconnectTestDb()
    fixtures.ts     # createTestUser(), createTestCourse(), createTestModule(), createTestAssignment()
  mocks/
    aiProvider.ts   # createMockAIProvider()
  hooks/
    useTheme.test.ts
  integration/
    auth/           # login, register, me
    courses/        # crud, enrollment, authorization, dashboard, generation, ai-error-handling
    assignments/    # crud, submissions
lib/
  models/
    *.test.ts       # Unit tests co-located with models
  utils/
    quizGrader.test.ts
  ai/
    services/*.test.ts
    utils/*.test.ts
  auth/
    jwt.test.ts
```

### New Files to Create
```
lib/utils/validateObjectId.ts              # Shared ObjectId validation utility
lib/auth/coursePermissions.ts              # getCoursePermissions() utility
lib/models/Enrollment.ts                   # New Enrollment model

app/api/courses/[id]/assignments/[assignmentId]/quiz/start/route.ts   # Split quiz start
app/api/courses/[id]/assignments/[assignmentId]/quiz/submit/route.ts  # Split quiz submit

__tests__/integration/quiz/               # Quiz route tests
__tests__/integration/queue/              # Queue worker tests
__tests__/integration/files/              # File upload/download tests (if audited)
__tests__/integration/notifications/      # Notification tests (if audited)
__tests__/integration/sharing/            # Share route tests (if audited)
__tests__/integration/account/            # Account deletion/export tests (if audited)
```

### Pattern: Test-Driven Route Handler Testing
```typescript
// Source: existing __tests__/integration/auth/login.test.ts
import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser, createTestCourse } from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import { POST } from "@/app/api/courses/[id]/assignments/[assignmentId]/quiz/route";

beforeAll(async () => { await connectTestDb(); }, 30000);
afterEach(async () => { await clearTestDb(); });
afterAll(async () => { await disconnectTestDb(); }, 30000);

describe("POST /api/courses/[id]/assignments/[assignmentId]/quiz?action=start", () => {
  it("starts a quiz attempt for enrolled student", async () => {
    // Setup: create user, course, enroll student, create quiz assignment
    // Act: call route handler directly
    // Assert: verify response shape and database state
  });
});
```

### Pattern: Enrollment Model Design
```typescript
// New Enrollment model with compound unique index
const enrollmentSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  enrolledAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Compound unique index prevents race condition -- database enforces uniqueness
enrollmentSchema.index({ course: 1, student: 1 }, { unique: true });
enrollmentSchema.index({ student: 1, enrolledAt: -1 });
```

### Pattern: getCoursePermissions() Design
```typescript
// Extends existing checkCourseOwnership from lib/auth/courseOwnership.ts
export interface CoursePermissions {
  isInstructor: boolean;
  isEnrolled: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isSharedWith: boolean;
  canEdit: boolean;
  canView: boolean;
}

export async function getCoursePermissions(
  course: ICourse,    // Already-fetched course document
  user: JWTPayload | null
): Promise<CoursePermissions> {
  // Pure function on already-fetched data -- no additional DB calls
  // Replaces all inline authorization checks across ~20 routes
}
```

### Pattern: validateObjectId() Utility
```typescript
import mongoose from "mongoose";
import { NextResponse } from "next/server";

export function validateObjectId(
  id: string,
  label = "ID"
): NextResponse | null {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: `Invalid ${label}` },
      { status: 400 }
    );
  }
  return null;
}
```

### Anti-Patterns to Avoid
- **Fixing without a failing test first:** Every fix MUST have a failing test demonstrating the bug before the fix is applied.
- **Refactoring enrollment in-place:** The enrollment refactor touches many files. Create the Enrollment model and migration utility first, then update routes one by one with tests.
- **Breaking quiz API contract:** When splitting quiz routes, the frontend may already call `?action=start` and `?action=submit`. Keep the old route working (redirect or re-export) while adding the new split routes.
- **Over-scoping page decomposition:** Only decompose monolithic pages if a bug is found in them. The decision explicitly says "don't restructure pages without bugs."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-memory MongoDB for tests | Custom mock DB layer | `mongodb-memory-server` (already in project) | Full Mongoose compatibility, indexes work, realistic behavior |
| Request building for tests | Raw `new Request()` construction | `buildRequest()` from `__tests__/helpers/api.ts` | Handles CSRF headers, auth tokens, content-type automatically |
| User/course test data | Inline `Model.create()` calls | `createTestUser()`, `createTestCourse()` etc from `__tests__/helpers/fixtures.ts` | Provides JWT tokens, handles defaults, increments counters |
| AI provider mocking | jest.mock on SDK modules | `createMockAIProvider()` from `__tests__/mocks/aiProvider.ts` | Tracks calls, configurable responses, error simulation |
| ObjectId validation | Inline `mongoose.Types.ObjectId.isValid()` per route | Shared `validateObjectId()` utility | Consistent error responses, DRY |
| Authorization checks | Inline `isInstructor`/`isEnrolled`/`isAdmin` per route | Shared `getCoursePermissions()` utility | Consistent logic, single source of truth |

## Common Pitfalls

### Pitfall 1: Enrollment Refactor Scope Underestimation
**What goes wrong:** The enrollment array `course.enrolledStudents` is referenced in 15+ API routes, the Course model, frontend pages, and the enrollment test file. Missing a reference causes silent authorization failures.
**Why it happens:** Enrollment checks appear in different forms: `.some()` on the array, `.includes()`, population with `enrolledStudents`, and `enrolledCount` computations.
**How to avoid:** Grep for all occurrences of `enrolledStudents` before starting. Create a migration plan mapping every file that reads or writes `enrolledStudents`. The Enrollment model needs methods like `isEnrolled(courseId, userId)` and `getEnrollmentCount(courseId)` to replace array operations.
**Warning signs:** Tests pass individually but fail when enrollment-dependent routes are tested together.

### Pitfall 2: Quiz Route Split Breaking Frontend
**What goes wrong:** The frontend quiz page at `app/(dashboard)/courses/[id]/assignments/[assignmentId]/quiz/page.tsx` (442 lines) calls the quiz API with `?action=start` and `?action=submit`. Splitting the route without updating the frontend breaks quiz functionality.
**Why it happens:** Route split is a backend concern but the API contract includes the `?action=` query parameter pattern.
**How to avoid:** Either (a) update the frontend to call new routes (`quiz/start`, `quiz/submit`), or (b) keep the old route as a thin dispatcher that redirects to the new routes internally. Option (a) is cleaner.
**Warning signs:** Quiz start works but submit fails (or vice versa).

### Pitfall 3: Soft-Delete Filter Missing on User Model
**What goes wrong:** User model has `deletedAt` field but no `pre(/^find/)` middleware. Soft-deleted users still appear in: instructor populates, enrollment lists, session queries, and AI generation logs.
**Why it happens:** User model was created before the soft-delete pattern was established on other models.
**How to avoid:** Add the same `pre(/^find/)` middleware pattern used by Course, Assignment, and Submission models. Test that `User.find()` excludes deleted users.
**Warning signs:** Deleted user names/emails appearing in course listings or notifications.

### Pitfall 4: ObjectId CastError Masking Real Bugs
**What goes wrong:** Routes without ObjectId validation pass invalid IDs to `Course.findById()`, which throws a Mongoose `CastError`. The generic catch block returns 500, hiding the actual issue from both users and developers.
**Why it happens:** The `findById()` API accepts any string but throws if it cannot cast to ObjectId.
**How to avoid:** Apply `validateObjectId()` at route entry, before any database call. Return 400 with a clear message.
**Warning signs:** 500 errors in logs with CastError stack traces.

### Pitfall 5: Race Condition in Enrollment
**What goes wrong:** Two concurrent enrollment requests both pass the `alreadyEnrolled` check (TOCTOU) and both push to the array, resulting in duplicate enrollment entries.
**Why it happens:** The check (`course.enrolledStudents.some(...)`) and the write (`course.enrolledStudents.push(...)`) are not atomic. `course.save()` overwrites the entire array.
**How to avoid:** The Enrollment collection refactor with a compound unique index `{ course: 1, student: 1 }` eliminates this entirely -- the database enforces uniqueness. Until then, `$addToSet` is a quick fix.
**Warning signs:** Duplicate student IDs in `enrolledStudents` array.

### Pitfall 6: Module/Lesson Lack Soft Delete
**What goes wrong:** Modules and Lessons have no `deletedAt` field. When a Course is soft-deleted, its modules and lessons remain as normal documents -- orphaned but visible.
**Why it happens:** Soft-delete was added to Course, Assignment, and Submission but not propagated to Module and Lesson.
**How to avoid:** This is in Claude's discretion. The practical impact depends on how deletion cascades. The admin trash route at `app/api/admin/trash/route.ts` should be checked for how it handles module/lesson cleanup. If cascading hard-delete is used there, adding soft-delete to Module/Lesson may not be needed.
**Warning signs:** Orphaned modules/lessons appearing in queries after their parent course is deleted.

## Code Examples

### Existing Test Pattern (from login.test.ts)
```typescript
// Source: __tests__/integration/auth/login.test.ts
describe("POST /api/auth/login", () => {
  it("logs in with valid credentials", async () => {
    await createTestUser({ email: "login@example.com", password: "password123" });
    const request = buildRequest("POST", "/api/auth/login", {
      body: { email: "login@example.com", password: "password123" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{ user: { email: string }; message: string }>(response);
    expect(status).toBe(200);
    expect(data.user.email).toBe("login@example.com");
  });
});
```

### Route Handler with Params Pattern (from enrollment.test.ts)
```typescript
// Source: __tests__/integration/courses/enrollment.test.ts
// Route handlers with params require Promise.resolve() wrapper
const response = await ENROLL(request, {
  params: Promise.resolve({ id: course._id.toString() }),
});
```

### Existing Authorization Pattern (duplicated across 20+ routes)
```typescript
// Source: app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts
// This pattern appears in almost every course-related route
const isInstructor = course.instructor.toString() === user.userId;
const isAdmin = user.role === "admin";
const isEnrolled = course.enrolledStudents.some(
  (s: { toString: () => string }) => s.toString() === user.userId
);

if (!isInstructor && !isAdmin && !isEnrolled) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Existing Soft-Delete Pattern (Course model)
```typescript
// Source: lib/models/Course.ts lines 122-127
courseSchema.pre(/^find/, function (this: mongoose.Query<unknown, ICourse>, next) {
  if (!this.getOptions().includeSoftDeleted) {
    this.where({ deletedAt: null });
  }
  next();
});
```

### Existing Course Ownership Check (extend this)
```typescript
// Source: lib/auth/courseOwnership.ts
export async function checkCourseOwnership(courseId: string, user: JWTPayload): Promise<CourseOwnershipResult> {
  // Returns: { isOwner, isInstructor, isEnrolled, isAdmin, course }
  // NOTE: This does an additional DB query for the course. getCoursePermissions()
  // should take an already-fetched course to avoid redundant queries.
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Enrollment via array on Course doc | Separate Enrollment collection | This phase | Eliminates race condition, scales beyond ~1000 students |
| `?action=` query param multiplexing | Separate route files per action | This phase | REST compliance, testability |
| Inline authorization per route | Shared `getCoursePermissions()` | This phase | Consistency, reduced bugs |
| No ObjectId validation | Shared `validateObjectId()` | This phase | Proper 400 errors instead of 500 CastErrors |

**Deprecated/outdated:**
- `enrolledStudents` array on Course model will be replaced by Enrollment collection but must remain readable during migration

## Codebase Audit Summary

### Files With Known Issues (from CONCERNS.md)

| File | Issue | Severity |
|------|-------|----------|
| `app/api/courses/[id]/enroll/route.ts` | Race condition (TOCTOU on enrollment) | HIGH |
| `lib/models/User.ts` | Has `deletedAt` field, no pre-find filter | MEDIUM |
| `app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts` | Multiplexed POST (387 lines) | MEDIUM |
| All routes under `app/api/courses/[id]/` | Missing ObjectId validation | MEDIUM |
| 20+ routes | Duplicated inline authorization | MEDIUM |
| `lib/models/Module.ts`, `lib/models/Lesson.ts` | No `deletedAt` field at all | LOW |
| `app/api/files/[...path]/route.ts` | No ownership check on file access | MEDIUM |

### Authorization Check Locations (All Need Consolidation)

Routes with inline `isInstructor`/`isEnrolled`/`isAdmin` checks (from grep):
- `app/api/courses/[id]/route.ts` (GET, PATCH, DELETE)
- `app/api/courses/[id]/enroll/route.ts`
- `app/api/courses/[id]/modules/route.ts`
- `app/api/courses/[id]/modules/[moduleId]/route.ts`
- `app/api/courses/[id]/modules/[moduleId]/lessons/route.ts`
- `app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/route.ts`
- `app/api/courses/[id]/assignments/route.ts`
- `app/api/courses/[id]/assignments/[assignmentId]/route.ts`
- `app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts`
- `app/api/courses/[id]/assignments/[assignmentId]/files/route.ts`
- `app/api/courses/[id]/assignments/[assignmentId]/submissions/route.ts`
- `app/api/courses/[id]/assignments/[assignmentId]/submissions/[submissionId]/route.ts`
- `app/api/courses/[id]/share/route.ts`
- `app/api/courses/[id]/gradebook/route.ts`
- `app/api/courses/[id]/grades/route.ts`
- `app/api/ai/chat/route.ts`
- `app/api/ai/generate/route.ts`
- `app/api/ai/generate/[contentId]/route.ts`

### Enrollment Array References (All Must Migrate)

Every place `enrolledStudents` is read or written:
- `lib/models/Course.ts` -- schema definition, index
- `app/api/courses/[id]/enroll/route.ts` -- push/filter/some
- `app/api/courses/route.ts` -- query filter `{ enrolledStudents: user.userId }`
- `app/api/courses/[id]/route.ts` -- some(), length, populate
- `app/api/courses/[id]/assignments/route.ts` -- some()
- `app/api/courses/[id]/assignments/[assignmentId]/route.ts` -- some()
- `app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts` -- some()
- `app/api/courses/[id]/assignments/[assignmentId]/files/route.ts` -- some()
- `app/api/courses/[id]/assignments/[assignmentId]/submissions/route.ts` -- some()
- `app/api/courses/[id]/modules/route.ts` -- some()
- `app/api/courses/[id]/grades/route.ts` -- some()
- `app/api/courses/[id]/gradebook/route.ts` -- (enrollment list for grade display)
- `app/api/ai/chat/route.ts` -- some()
- `app/api/ai/generate/route.ts` -- some()
- `app/api/ai/generate/[contentId]/route.ts` -- some()
- `lib/auth/courseOwnership.ts` -- some()
- Frontend pages that read enrollment status from API responses

### Test Coverage Gaps (Zero Coverage)

| Area | Files | Risk |
|------|-------|------|
| Quiz routes | `app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts` | HIGH |
| Queue worker | `lib/queue/worker.ts` | HIGH |
| AI generation handlers | `lib/queue/handlers/aiGeneration.ts` (567 lines) | HIGH |
| YouTube generation handler | `lib/queue/handlers/youtubeGeneration.ts` | HIGH |
| File upload/download | `app/api/courses/[id]/assignments/[assignmentId]/files/route.ts`, `app/api/files/[...path]/route.ts` | MEDIUM |
| Course sharing | `app/api/courses/[id]/share/route.ts` | MEDIUM |
| Notifications | `app/api/notifications/` | LOW |
| Account deletion | `app/api/users/me/delete/route.ts` | HIGH |
| Gradebook | `app/api/courses/[id]/gradebook/route.ts` | MEDIUM |

## Open Questions

1. **Quiz route frontend contract**
   - What we know: The quiz route uses `?action=start` and `?action=submit` query params. The frontend quiz page (442 lines) calls this API.
   - What's unclear: Exact frontend fetch calls -- whether they use query params or could easily switch to new route paths.
   - Recommendation: Grep the frontend quiz page for the API call pattern before deciding on backward compatibility strategy. Likely simplest to update the frontend to call new routes directly since we control both ends.

2. **Enrollment migration strategy**
   - What we know: `enrolledStudents` array is on the Course document and referenced in 15+ files. The new Enrollment collection needs a compound unique index.
   - What's unclear: Whether existing data needs migration (there may be real enrollment data from testing/development).
   - Recommendation: Create Enrollment model with index. For each route, read from Enrollment collection. Remove array from Course model only after all routes are migrated. No data migration needed if this is pre-production.

3. **Soft-delete scope (Claude's discretion)**
   - What we know: Course, Assignment, Submission have soft-delete. User has the field but no filter. Module and Lesson have neither.
   - What's unclear: Whether the admin trash route hard-deletes or soft-deletes modules/lessons.
   - Recommendation: Check `app/api/admin/trash/route.ts` during implementation. If modules/lessons are hard-deleted when courses are trashed, adding soft-delete to them is unnecessary. For User, adding the pre-find filter is clearly needed since the field already exists.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.2.0 |
| Config file | `jest.config.ts` |
| Quick run command | `npm test -- --testPathPattern="<pattern>" --forceExit` |
| Full suite command | `npm test -- --forceExit` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUGS-01 (auth) | Register, login, logout, session persistence works | integration | `npm test -- --testPathPattern="auth" --forceExit` | Partial (login, register, me exist; logout, refresh, session missing) |
| BUGS-01 (enrollment) | Enrollment flow with Enrollment collection | integration | `npm test -- --testPathPattern="enrollment" --forceExit` | Existing tests need rewrite for Enrollment model |
| BUGS-01 (quiz) | Quiz start, answer, submit, results for all question types | integration | `npm test -- --testPathPattern="quiz" --forceExit` | Wave 0 |
| BUGS-01 (generation) | Course generation end-to-end | integration | `npm test -- --testPathPattern="generation" --forceExit` | Partial (generation.test.ts, ai-error-handling.test.ts) |
| BUGS-01 (objectid) | Invalid ObjectId returns 400 not 500 | integration | `npm test -- --testPathPattern="objectid\|validation" --forceExit` | Wave 0 |
| BUGS-01 (permissions) | getCoursePermissions() returns correct flags | unit | `npm test -- --testPathPattern="coursePermissions" --forceExit` | Wave 0 |
| BUGS-01 (queue) | Queue worker processes, retries, and handles failures | integration | `npm test -- --testPathPattern="queue\|worker" --forceExit` | Wave 0 |
| BUGS-01 (soft-delete) | Deleted users excluded from queries | integration | `npm test -- --testPathPattern="soft-delete\|User.test" --forceExit` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="<affected-area>" --forceExit`
- **Per wave merge:** `npm test -- --forceExit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/integration/quiz/` directory and quiz flow tests -- covers BUGS-01 (quiz)
- [ ] `__tests__/integration/queue/worker.test.ts` -- covers BUGS-01 (queue)
- [ ] `lib/utils/validateObjectId.test.ts` -- covers BUGS-01 (objectid)
- [ ] `lib/auth/coursePermissions.test.ts` -- covers BUGS-01 (permissions)
- [ ] `lib/models/Enrollment.test.ts` -- covers BUGS-01 (enrollment)
- [ ] Test fixtures need `createTestEnrollment()` and `createTestQuizAssignment()` helpers

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all API routes, models, and test files
- `.planning/codebase/CONCERNS.md` -- comprehensive known issues audit from 2026-03-05
- `__tests__/` -- existing test infrastructure, patterns, and helpers
- All Mongoose model files -- schema definitions, indexes, soft-delete patterns

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions -- user-confirmed approach for enrollment refactor, quiz split, authorization consolidation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries are already in the project, no new dependencies
- Architecture: HIGH -- existing test patterns and code structure are well-understood from direct reading
- Pitfalls: HIGH -- CONCERNS.md provides verified list of known issues; authorization pattern confirmed by grep across all routes
- Enrollment refactor scope: HIGH -- all references to `enrolledStudents` enumerated via grep

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- internal codebase, no external API changes)
