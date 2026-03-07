# Phase 2: Role Simplification & Course Generation - Research

**Researched:** 2026-03-06
**Domain:** Authorization refactoring, unified AI+YouTube course generation, dashboard UX
**Confidence:** HIGH

## Summary

Phase 2 transforms Kantigo from a role-gated platform into a unified learner experience. The work has three distinct domains: (1) removing teacher role checks from the UI and replacing role-based API authorization with ownership-based checks, (2) building a unified course generation flow that merges the existing AI syllabus and YouTube path generation pipelines into a single endpoint, and (3) redesigning the dashboard with an inline generation input and two-section course layout.

The codebase is well-positioned for this change. Both AI and YouTube generation handlers already set `owner: userId` and `isPublished: true`, use the same job queue system, and return `{ courseId }` on completion. The `SyllabusGeneratorService` already supports `includeVideos: true` with a `VIDEO_SYSTEM_PROMPT_ADDENDUM` that instructs the AI to decide which lessons should be text vs video. The existing `ai.generate-syllabus` job handler already fills video lessons with YouTube data when `includeVideos` is true. The primary engineering work is: (a) creating a new unified API endpoint that always enables video mixing, (b) refactoring 4 explicit teacher role checks and ~15 instructor-based authorization checks to use ownership-aware patterns, and (c) rebuilding the dashboard page.

**Primary recommendation:** Build the unified generation as a new API endpoint (`POST /api/courses/generate`) that combines the syllabus generation + YouTube filling into one flow, always passing `includeVideos: true`. This reuses the existing `ai.generate-syllabus` job handler which already handles the full hybrid flow. The role cleanup is straightforward -- most API routes already use `course.instructor === user.userId` checks which are ownership-based by nature; only 4 routes explicitly check `user.role === "teacher"`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Generation entry point: inline text input on dashboard, styled like a search bar ("What do you want to learn?"), topic + skill level selector only, no model selector or duration field -- truly 2-click
- Unified generation: AI decides text vs video mix autonomously, single backend flow
- Progress: generating card on dashboard, user can browse during generation, auto-redirect on completion, reuse existing job polling pattern
- Generation limits: hard limit of 5 courses per user total, clear messaging when reached
- Dashboard layout: "My Courses" (generated) at top, "Enrolled Courses" below, progress-focused stats (lessons completed, courses in progress, completion percentages), no teacher stats
- Empty state: generation-focused welcome, input bar front and center, 3-4 topic suggestion chips
- Role cleanup -- accounts: role field stays in DB, existing teachers keep working, remove role dropdown from registration, default to student
- Role cleanup -- traditional creation: `/courses/new` restricted to admin only
- Role cleanup -- API: replace ALL teacher role checks with ownership-based, use existing `checkCourseOwnership()` / `canModifyOwnedCourse()` helpers
- Sidebar: keep as-is (Dashboard, My Courses, Profile, Settings)

### Claude's Discretion
- Exact implementation of the unified AI+YouTube generation pipeline
- How to merge the two separate job handlers into one flow
- Progress indicator design on the dashboard
- How to implement the 5-course limit (DB field vs query count)
- Topic suggestion chip content and selection logic
- Skill level UI treatment (buttons, segmented control, or pills)

### Deferred Ideas (OUT OF SCOPE)
- Pricing tiers to replace the hard 5-course limit
- Additional context / preferences field for generation
- Model selection for power users
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROLE-01 | Any authenticated user can generate courses (no teacher role required) | New unified endpoint uses `requireAuth` not `requireRole`; removes teacher check from `POST /api/courses` |
| ROLE-02 | Registration page has no role selection | Remove role dropdown from register page, remove role from `registerSchema`, hardcode default `"student"` |
| ROLE-03 | Teacher-specific UI elements removed from student-facing pages | Dashboard, courses page, assignments page, layout sidebar all have teacher-conditional rendering to remove |
| ROLE-04 | Admin retains ability to manually create and edit courses | `POST /api/courses` changes from `teacher/admin` to `admin` only; `/courses/new` page gated to admin |
| ROLE-05 | API routes use ownership-based authorization instead of role-based checks | 4 routes have explicit `role === "teacher"` checks; ~15 routes use `instructor === userId` (already ownership-based) |
| CGEN-01 | Course generation produces hybrid courses mixing AI text and YouTube video lessons | Existing `ai.generate-syllabus` handler already supports `includeVideos: true` and fills YouTube data |
| CGEN-02 | AI decides which lessons are text vs video | `SyllabusGeneratorService` has `VIDEO_SYSTEM_PROMPT_ADDENDUM` that instructs AI to decide per-lesson |
| CGEN-03 | Single unified generation flow | New `POST /api/courses/generate` endpoint replaces separate AI syllabus and YouTube path endpoints for learners |
| DASH-01 | Dashboard has a prominent "Create Course" entry point | Inline search-bar style input with "What do you want to learn?" placeholder |
| DASH-02 | Course generation starts in 2 clicks | Topic input + Generate button; skill level has sensible default (Beginner) |
| DASH-03 | Dashboard shows enrolled and generated courses clearly | Two sections: "My Courses" (owner-based query) and "Enrolled Courses" (enrolledStudents query) |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 | App Router, Route Handlers | Project framework |
| React | 19 | UI components | Project framework |
| Tailwind CSS | 4 | Styling | Project framework |
| Mongoose | 8 | MongoDB ODM | Project ORM |
| Zod | 4 | Request validation | Project validation |
| Jest | 30 | Testing | Project test framework |

### Existing Services to Reuse
| Service | Location | Purpose | Reuse Strategy |
|---------|----------|---------|----------------|
| `SyllabusGeneratorService` | `lib/ai/services/syllabusGenerator.ts` | Generates syllabus with optional video support | Pass `includeVideos: true` always |
| `YouTubePathService` | `lib/youtube/youtubePathService.ts` | Searches YouTube + LLM curriculum | NOT used in unified flow -- the syllabus handler already fills YouTube data inline |
| `ai.generate-syllabus` handler | `lib/queue/handlers/aiGeneration.ts` | Job handler for syllabus + video filling | Reuse directly -- already handles full hybrid flow |
| `enforceAIRateLimit` | `lib/ai/rateLimit.ts` | Rate limiting | Reuse + add 5-course limit check |
| `checkCourseOwnership` | `lib/auth/courseOwnership.ts` | Ownership authorization | Use in refactored API routes |
| MongoQueue + Job polling | `lib/queue/` + `app/api/jobs/[jobId]/` | Async job processing | Reuse for generation progress |

### No New Dependencies Needed
This phase adds zero new npm packages. All functionality is built on existing infrastructure.

## Architecture Patterns

### Recommended Changes Structure
```
app/
├── (auth)/
│   └── register/page.tsx           # Remove role dropdown
├── (dashboard)/
│   ├── dashboard/page.tsx          # Full rewrite: inline generation + two-section layout
│   ├── courses/page.tsx            # Remove teacher conditionals
│   ├── courses/[id]/
│   │   └── assignments/page.tsx    # Replace isTeacher with ownership check
│   ├── courses/new/page.tsx        # Gate to admin only (add admin check)
│   └── layout.tsx                  # Remove role display, simplify nav
├── api/
│   ├── courses/
│   │   ├── route.ts                # POST: change teacher/admin -> admin only
│   │   └── generate/route.ts       # NEW: unified generation endpoint
│   └── ai/generate/route.ts        # Remove teacher role check
lib/
├── validation/
│   └── authSchemas.ts              # Remove role from registerSchema
└── auth/
    └── courseOwnership.ts          # Already ready, no changes needed
```

### Pattern 1: Unified Generation Endpoint
**What:** New `POST /api/courses/generate` that takes `{ topic, skillLevel }` and enqueues a job
**When to use:** All learner-initiated course generation

The endpoint:
1. Authenticates user (no role check)
2. Checks 5-course limit: `Course.countDocuments({ owner: userId })`
3. Checks rate limit via `enforceAIRateLimit`
4. Enqueues `ai.generate-syllabus` job with `includeVideos: true`, `estimatedDuration: "auto"`, and no model/tier overrides
5. Returns `{ jobId }` with 202 status

```typescript
// POST /api/courses/generate
const generateSchema = z.object({
  topic: z.string().min(1).max(500),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
});

// In handler:
const courseCount = await Course.countDocuments({ owner: user.userId });
if (courseCount >= 5) {
  return NextResponse.json(
    { error: "You've reached the maximum of 5 generated courses." },
    { status: 429 }
  );
}

const jobId = await enqueueJob({
  type: "ai.generate-syllabus",
  data: {
    topic,
    targetLevel: skillLevel,
    estimatedDuration: "4-6 hours",
    includeVideos: true,
  },
  userId: user.userId,
});
```

### Pattern 2: Authorization Refactoring
**What:** Replace `role === "teacher"` checks with instructor/owner-based checks
**When to use:** Every API route that currently gates on teacher role

There are two distinct patterns in the codebase:

**A. Explicit role checks (4 locations) -- MUST change:**
1. `POST /api/courses` -- `user.role !== "teacher" && user.role !== "admin"` -> `user.role !== "admin"` (manual creation is admin-only)
2. `POST /api/ai/generate` -- `user.role !== "teacher" && user.role !== "admin"` -> remove check entirely (use instructor/owner check that follows)
3. `GET /api/ai/generate` -- `user.role === "teacher"` branch in query logic -> change to instructor-based query
4. `GET /api/courses` -- `user.role === "teacher"` branch in query logic -> unify with student logic

**B. Instructor-based checks (~15 locations) -- already ownership-based, check for owner too:**
These routes check `course.instructor.toString() !== user.userId && user.role !== "admin"`. They need to ALSO allow `course.owner?.toString() === user.userId`. The pattern becomes:
```typescript
const isAuthorized =
  course.instructor.toString() === user.userId ||
  course.owner?.toString() === user.userId ||
  user.role === "admin";

if (!isAuthorized) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Pattern 3: Dashboard Two-Section Layout
**What:** Dashboard fetches courses in two queries: owner-based and enrolled
**When to use:** Dashboard page component

```typescript
// Fetch generated courses (owned by user)
const generatedRes = await fetch("/api/courses/ai/my-courses");

// Fetch enrolled courses
const enrolledRes = await fetch("/api/courses?enrolled=true");
```

The `GET /api/courses/ai/my-courses` endpoint already exists and returns owner-based courses. The `GET /api/courses` with `?enrolled=true` param is already handled in the teacher branch -- just needs to be available for all roles.

### Pattern 4: Inline Generation on Dashboard
**What:** Search-bar style input with topic field, skill level selector, and Generate button
**When to use:** Dashboard page

Key UI decisions:
- Input bar: full-width search-bar style at top of dashboard
- Skill level: three pill buttons (Beginner/Intermediate/Advanced), default to Beginner
- Generate button: gradient styled (`from-indigo-600 to-violet-600`)
- After submit: replace input area with generating card showing spinner and progress bar
- On completion: auto-redirect to `/courses/{courseId}`
- Reuse the `pollJobStatus` pattern from existing AI course page

### Anti-Patterns to Avoid
- **Don't create a new job type:** The existing `ai.generate-syllabus` job handler with `includeVideos: true` already handles the full hybrid flow. Creating a separate `ai.generate-hybrid-course` handler duplicates logic.
- **Don't remove the role field from the database:** The role field stays. The User model keeps its `student | teacher | admin` enum. Only the UI and API authorization logic changes.
- **Don't use `requireRole` wrapper for the new generation endpoint:** Use `requireAuth` since any authenticated user can generate.
- **Don't query count on every dashboard load for the 5-course limit:** Check only at generation time, not for display.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hybrid course generation | New generation pipeline | Existing `ai.generate-syllabus` handler with `includeVideos: true` | Already handles AI syllabus -> YouTube video filling -> Course/Module/Lesson creation |
| Job polling | Custom WebSocket system | Existing `GET /api/jobs/{jobId}` + `setInterval` pattern | Already proven, used by AI generation page |
| Rate limiting | Custom rate limiter | Existing `enforceAIRateLimit()` | Production-ready with atomic DB operations |
| Ownership authorization | New auth middleware | Existing `checkCourseOwnership()` helpers | Already handles owner, instructor, enrolled, admin checks |
| Course count for limit | Custom counter model | `Course.countDocuments({ owner: userId })` | Simple, accurate, no new infrastructure |

**Key insight:** The unified generation flow already exists as the `ai.generate-syllabus` handler with `includeVideos: true`. The "new" endpoint is just a simplified API wrapper that hardcodes `includeVideos: true` and removes model/tier/duration options.

## Common Pitfalls

### Pitfall 1: Breaking Existing Teacher Accounts
**What goes wrong:** Existing teachers lose access to courses they created
**Why it happens:** Overzealous removal of teacher role checks without ensuring instructor-based access still works
**How to avoid:** The instructor-based checks (`course.instructor === user.userId`) MUST remain. Only the explicit `role === "teacher"` checks change. Teachers continue to function through instructor-based authorization.
**Warning signs:** Test with a teacher account after role cleanup -- they should still see and manage their courses.

### Pitfall 2: GET /api/courses Query Logic Breaks
**What goes wrong:** Users can't see their courses after the role-based query is unified
**Why it happens:** The `GET /api/courses` route has separate query logic for teachers vs students. Unifying it incorrectly could hide courses.
**How to avoid:** Unify the query to:
```typescript
query = {
  $or: [
    { instructor: user.userId },
    { owner: user.userId },
    { enrolledStudents: user.userId },
    { sharedWith: user.userId },
    { isPublished: true, owner: { $exists: false } },
  ],
};
```
This covers: courses they teach, courses they generated, courses they enrolled in, shared courses, and published instructor-created courses.
**Warning signs:** Empty course list after login.

### Pitfall 3: Race Condition on 5-Course Limit
**What goes wrong:** User generates 6+ courses by clicking Generate rapidly
**Why it happens:** Count check and job enqueue aren't atomic
**How to avoid:** The window is small (check -> enqueue is milliseconds) and the consequence is minor (6 courses instead of 5). For v1, a simple `countDocuments` check before enqueue is sufficient. The rate limiter also acts as a secondary guard. Don't over-engineer.
**Warning signs:** Not a realistic concern for early users.

### Pitfall 4: Missing CSRF Header in New Generation Endpoint
**What goes wrong:** Generation requests fail with 403
**Why it happens:** New fetch calls from client don't include `X-Requested-With: XMLHttpRequest` header
**How to avoid:** All POST requests in this codebase must include the CSRF header. Copy the pattern from existing fetch calls.
**Warning signs:** 403 errors on generation attempts.

### Pitfall 5: Registration Tests Break
**What goes wrong:** Existing test "registers a teacher when role is teacher" fails
**Why it happens:** Removing the `role` field from `registerSchema` makes this test invalid
**How to avoid:** Update the test to verify that role is NOT accepted (or that it's ignored). Also update the test "defaults role to student when not provided" to become the primary registration test.
**Warning signs:** Test failures after schema change.

### Pitfall 6: Dashboard Loading Two Separate API Calls
**What goes wrong:** Dashboard is slow due to waterfall API calls
**Why it happens:** Fetching generated courses and enrolled courses sequentially
**How to avoid:** Use `Promise.all` to fetch both in parallel, same pattern the current dashboard already uses.
**Warning signs:** Noticeable load time increase.

## Code Examples

### Unified Generation API Endpoint
```typescript
// app/api/courses/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requireCsrf } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Course } from "@/lib/models";
import { enqueueJob } from "@/lib/queue";
import { enforceAIRateLimit, addRateLimitHeaders } from "@/lib/ai/rateLimit";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { captureException } from "@/lib/logger";

const MAX_GENERATED_COURSES = 5;

const generateCourseSchema = z.object({
  topic: z.string().min(1).max(500),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
});

export async function POST(request: NextRequest) {
  const csrfError = requireCsrf(request);
  if (csrfError) return csrfError;

  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const validation = generateCourseSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }

  const { topic, skillLevel } = validation.data;

  await dbConnect();

  // Check 5-course limit
  const courseCount = await Course.countDocuments({ owner: user.userId });
  if (courseCount >= MAX_GENERATED_COURSES) {
    return NextResponse.json(
      { error: "You've reached the maximum of 5 generated courses. Delete a course to create a new one." },
      { status: 429 }
    );
  }

  // Rate limit check
  const subTier = user.role === "admin" ? "admin" as const : user.subscriptionTier;
  const rateCheck = await enforceAIRateLimit(user.userId, subTier, "credits");
  if (rateCheck.blocked) return rateCheck.response;

  // Verify provider is configured
  const resolved = resolveProvider({});
  if (!resolved) {
    return NextResponse.json(
      { error: "AI service is temporarily unavailable." },
      { status: 503 }
    );
  }

  const jobId = await enqueueJob({
    type: "ai.generate-syllabus",
    data: {
      topic,
      targetLevel: skillLevel,
      estimatedDuration: "4-6 hours",
      includeVideos: true,
    },
    userId: user.userId,
  });

  const jsonResponse = NextResponse.json({ jobId }, { status: 202 });
  addRateLimitHeaders(jsonResponse, rateCheck.result);
  return jsonResponse;
}
```

### Authorization Refactoring Pattern
```typescript
// Before (role-based):
if (user.role !== "teacher" && user.role !== "admin") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// After (ownership-based for write operations):
const isAuthorized =
  course.instructor.toString() === user.userId ||
  course.owner?.toString() === user.userId ||
  user.role === "admin";

if (!isAuthorized) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Registration Schema Change
```typescript
// Before:
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: passwordSchema,
  role: z.enum(["student", "teacher"]).default("student"),
});

// After:
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: passwordSchema,
});
// Role is always "student" for new registrations -- set in the API handler
```

### Dashboard Inline Generation Component Structure
```typescript
// State management for generation flow
type GenerationPhase = "idle" | "submitting" | "generating" | "complete";

// Topic suggestion chips
const TOPIC_SUGGESTIONS = [
  "Python for Beginners",
  "Web Development Basics",
  "Data Science Fundamentals",
  "Machine Learning 101",
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate AI + YouTube generation | Unified hybrid generation | Phase 2 | Users get best of both in one click |
| Teacher/Student role gates | Ownership-based authorization | Phase 2 | Any user can create courses |
| Role selection at registration | Automatic student role | Phase 2 | Simpler onboarding |
| Navigate to separate page for generation | Inline dashboard generation | Phase 2 | 2-click generation |

## Complete File Change Inventory

### Files with Explicit `role === "teacher"` Checks (MUST change)
| File | Line | Current Check | New Behavior |
|------|------|---------------|-------------|
| `app/api/courses/route.ts:30` | GET query | `user.role === "teacher"` branch | Unified query for all roles |
| `app/api/courses/route.ts:121` | POST guard | `user.role !== "teacher" && user.role !== "admin"` | `user.role !== "admin"` (admin-only for manual creation) |
| `app/api/ai/generate/route.ts:51` | POST guard | `user.role !== "teacher" && user.role !== "admin"` | Remove; use course-level instructor/owner check |
| `app/api/ai/generate/route.ts:207` | GET query | `user.role === "teacher"` branch | Instructor-based query for all roles |

### UI Files with Teacher Conditionals (MUST change)
| File | Lines | What to Change |
|------|-------|----------------|
| `app/(dashboard)/dashboard/page.tsx` | 93, 100-109, 125-159, 164-228 | Full rewrite: remove all role conditionals, add inline generation, two-section layout |
| `app/(dashboard)/courses/page.tsx` | 88-109, 129-131 | Remove teacher conditionals, simplify to single view for all users |
| `app/(dashboard)/courses/[id]/assignments/page.tsx` | 110, 137 | Replace `isTeacher` with course ownership check |
| `app/(dashboard)/layout.tsx` | 66-69, 162 | Remove role-based nav filtering and role display |
| `app/(auth)/register/page.tsx` | 14, 130-153 | Remove role dropdown and state |

### Schema/Model Files
| File | What to Change |
|------|----------------|
| `lib/validation/authSchemas.ts:20` | Remove `role` from `registerSchema` |
| `app/api/auth/register/route.ts:27` | Hardcode `role: "student"` instead of using validated `role` |

### API Routes Using Instructor-Based Auth (review, most are fine)
These routes check `course.instructor.toString() === user.userId`. They need to also allow `course.owner?.toString() === user.userId`:
| Route | Methods | Current | Needs Owner Check? |
|-------|---------|---------|-------------------|
| `courses/[id]/route.ts` | PATCH, DELETE | instructor + admin | YES -- add owner |
| `courses/[id]/modules/route.ts` | POST | instructor + admin | YES -- add owner |
| `courses/[id]/modules/[moduleId]/route.ts` | PATCH, DELETE | instructor + admin | YES -- add owner |
| `courses/[id]/modules/[moduleId]/lessons/route.ts` | POST | instructor + admin | YES -- add owner |
| `courses/[id]/modules/[moduleId]/lessons/[lessonId]/route.ts` | PATCH, DELETE | instructor + admin | YES -- add owner |
| `courses/[id]/assignments/route.ts` | POST | instructor + admin | YES -- add owner |
| `courses/[id]/assignments/[assignmentId]/route.ts` | PATCH, DELETE | instructor + admin | YES -- add owner |

### New Files to Create
| File | Purpose |
|------|---------|
| `app/api/courses/generate/route.ts` | Unified generation endpoint |
| `components/dashboard/GenerationInput.tsx` | Inline generation search bar component |
| `components/dashboard/GeneratingCard.tsx` | Generation progress card component |
| `components/dashboard/CourseSection.tsx` | Reusable course grid section |

### Test Files to Update
| File | What Changes |
|------|-------------|
| `__tests__/integration/auth/register.test.ts` | Update "registers a teacher" test, verify role is ignored |
| `__tests__/integration/courses/crud.test.ts` | Update "prevents student from creating" test (now admin-only gate) |

## Open Questions

1. **Skill Level Mapping Between Systems**
   - What we know: AI syllabus uses `beginner | intermediate | advanced`. YouTube path uses `complete_beginner | some_basics | intermediate | advanced`.
   - What's unclear: The unified flow uses the AI system's `targetLevel`, which maps directly. Since we're using the `ai.generate-syllabus` handler (not the YouTube handler), this is already resolved.
   - Recommendation: Use `beginner | intermediate | advanced` for the unified input. No mapping needed.

2. **`estimatedDuration` Field for Unified Generation**
   - What we know: The existing `ai.generate-syllabus` endpoint requires `estimatedDuration`. The unified flow removes this from user input.
   - What's unclear: What value to pass. The AI prompt uses it to calibrate module/lesson count.
   - Recommendation: Pass a sensible default like `"4-6 hours"` or `"auto"` and let the AI decide scope based on topic complexity. The prompt already adapts based on target level.

3. **What Happens to the Existing `/courses/new/ai` Page?**
   - What we know: It has more options (duration, additional context, model selector, include videos checkbox).
   - What's unclear: Should it remain for admin, be removed entirely, or be simplified?
   - Recommendation: Keep it as-is but gate it to admin only, alongside `/courses/new`. Admin power users may want the full options. Regular users use the simplified dashboard input.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 |
| Config file | `jest.config.ts` (exists) |
| Quick run command | `npm test -- --testPathPattern="path" --no-coverage` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROLE-01 | Any user can generate courses | integration | `npm test -- __tests__/integration/courses/generation.test.ts -x` | Wave 0 |
| ROLE-02 | Registration has no role selection | integration | `npm test -- __tests__/integration/auth/register.test.ts -x` | Exists (update) |
| ROLE-03 | No teacher UI elements in learner pages | manual-only | Visual inspection of dashboard, courses page | N/A |
| ROLE-04 | Admin retains manual course creation | integration | `npm test -- __tests__/integration/courses/crud.test.ts -x` | Exists (update) |
| ROLE-05 | Ownership-based API authorization | integration | `npm test -- __tests__/integration/courses/authorization.test.ts -x` | Wave 0 |
| CGEN-01 | Hybrid course generation | integration | `npm test -- __tests__/integration/courses/generation.test.ts -x` | Wave 0 |
| CGEN-02 | AI decides text vs video | unit | `npm test -- lib/ai/services/syllabusGenerator.test.ts -x` | Exists (update) |
| CGEN-03 | Single unified generation flow | integration | `npm test -- __tests__/integration/courses/generation.test.ts -x` | Wave 0 |
| DASH-01 | Dashboard generation entry point | manual-only | Visual inspection | N/A |
| DASH-02 | 2-click generation | manual-only | User flow test | N/A |
| DASH-03 | Shows enrolled and generated courses | integration | `npm test -- __tests__/integration/courses/dashboard.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="relevant-file" --no-coverage`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/integration/courses/generation.test.ts` -- covers ROLE-01, CGEN-01, CGEN-03 (unified generation endpoint)
- [ ] `__tests__/integration/courses/authorization.test.ts` -- covers ROLE-05 (ownership-based auth)
- [ ] Update `__tests__/integration/auth/register.test.ts` -- covers ROLE-02 (no role in registration)
- [ ] Update `__tests__/integration/courses/crud.test.ts` -- covers ROLE-04 (admin-only manual creation)

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis -- all files read and cross-referenced
- `lib/ai/services/syllabusGenerator.ts` -- verified `includeVideos` flag and `VIDEO_SYSTEM_PROMPT_ADDENDUM`
- `lib/queue/handlers/aiGeneration.ts` -- verified `ai.generate-syllabus` handler fills YouTube data when `includeVideos: true`
- `lib/auth/courseOwnership.ts` -- verified `checkCourseOwnership`, `canModifyOwnedCourse`, `canAccessOwnedCourse` helpers
- Complete grep of all `role === "teacher"` checks across `app/` and `lib/`

### Secondary (MEDIUM confidence)
- None needed -- this is purely an internal refactoring phase with no new external dependencies

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing infrastructure
- Architecture: HIGH -- existing patterns verified by reading actual code
- Pitfalls: HIGH -- enumerated every file that needs changes through code analysis
- Authorization audit: HIGH -- complete grep of all instructor/role checks in API routes

**Research date:** 2026-03-06
**Valid until:** indefinite (internal refactoring, no external dependency version concerns)
