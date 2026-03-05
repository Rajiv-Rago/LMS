# Codebase Concerns

**Analysis Date:** 2026-03-05

## Tech Debt

**Course Detail Page is Monolithic (1152 lines):**
- Issue: `app/(dashboard)/courses/[id]/page.tsx` contains 1152 lines with 23+ `useState`/`useEffect` calls, managing course display, module CRUD, lesson CRUD, AI generation state, model selection, and enrollment all in one component.
- Files: `app/(dashboard)/courses/[id]/page.tsx`
- Impact: Extremely difficult to modify any single feature without risking regression in others. Cognitive load for developers is very high.
- Fix approach: Extract into sub-components (`ModuleList`, `LessonItem`, `AIGenerationPanel`, `CourseHeader`). Move related state into custom hooks (e.g., `useModuleManagement`, `useAIGeneration`).

**Large Page Components Across Dashboard:**
- Issue: Several page components exceed 300-500 lines and combine data fetching, state management, and UI rendering.
- Files:
  - `app/(dashboard)/courses/[id]/modules/[moduleId]/lessons/[lessonId]/page.tsx` (710 lines)
  - `app/(dashboard)/courses/[id]/assignments/[assignmentId]/page.tsx` (516 lines)
  - `app/(dashboard)/courses/[id]/assignments/[assignmentId]/quiz/page.tsx` (442 lines)
  - `app/(dashboard)/courses/[id]/assignments/page.tsx` (398 lines)
  - `app/(dashboard)/courses/[id]/ai/generate/page.tsx` (381 lines)
- Impact: Hard to test, reuse, and maintain. Mix of concerns makes changes risky.
- Fix approach: Extract shared patterns into hooks (`useCourseData`, `usePermissions`). Break pages into layout + feature components.

**Quiz Route Handles Multiple Actions in Single POST:**
- Issue: `app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts` (387 lines) uses `?action=start` and `?action=submit` query params to multiplex two fundamentally different operations into one POST handler.
- Files: `app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts`
- Impact: Violates REST conventions, makes the route harder to understand and test.
- Fix approach: Split into separate route files or use a nested route structure (`quiz/start/route.ts`, `quiz/submit/route.ts`).

**Duplicated Authorization Patterns:**
- Issue: Nearly every API route manually checks `isInstructor`, `isEnrolled`, `isAdmin` with repeated inline code like `course.enrolledStudents.some((s: { toString: () => string }) => s.toString() === user.userId)`.
- Files: Most routes under `app/api/courses/[id]/`, particularly:
  - `app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts`
  - `app/api/courses/[id]/assignments/[assignmentId]/files/route.ts`
  - `app/api/courses/[id]/modules/route.ts`
  - `app/api/courses/[id]/enroll/route.ts`
- Impact: Authorization logic is inconsistent across routes (some check `isSharedWith`, some do not). Bug-prone when adding new access rules.
- Fix approach: Create a `getCoursePermissions(course, userId, role)` utility that returns `{ isInstructor, isEnrolled, isSharedWith, isAdmin, canEdit, canView }`. Use it consistently.

**`as any` Casts in Assignment Updates:**
- Issue: `quizSettings` and `projectSettings` are cast to `any` when updating assignments because Mongoose types do not match Zod-validated types.
- Files: `app/api/courses/[id]/assignments/[assignmentId]/route.ts` (lines 210-214)
- Impact: Type safety gap. Could allow malformed data to be persisted if Zod schema and Mongoose schema diverge.
- Fix approach: Align Mongoose schema types with Zod types, or create explicit mapping functions.

**AI Generation Handler is 567 Lines:**
- Issue: `lib/queue/handlers/aiGeneration.ts` registers three handlers in one file, each with substantial logic for provider resolution, content generation, logging, and notifications.
- Files: `lib/queue/handlers/aiGeneration.ts`
- Impact: Hard to test individual handlers. Duplicated patterns across handlers (provider resolution, error logging).
- Fix approach: Extract each handler into its own file. Create a shared `resolveAndValidateProvider()` helper.

## Known Bugs

**Enrollment Race Condition:**
- Symptoms: Two concurrent enrollment requests could both succeed, adding the same student twice to `enrolledStudents`.
- Files: `app/api/courses/[id]/enroll/route.ts` (line 57)
- Trigger: User double-clicks the Enroll button or makes concurrent requests.
- Workaround: The `alreadyEnrolled` check (line 46) prevents most cases, but a TOCTOU race exists between check and push. Use `$addToSet` instead of `push` for atomic enrollment.

**User Model Missing Soft-Delete Query Filter:**
- Symptoms: Deleted users (with `deletedAt` set) can still appear in queries because the User model has a `deletedAt` field but no `pre(/^find/)` middleware to exclude soft-deleted records.
- Files: `lib/models/User.ts` (has `deletedAt` field at line 101 but no pre-find hook)
- Trigger: After a user account is deleted via `app/api/users/me/delete/route.ts`, the anonymized user record is still returned by `User.find()`, `User.findOne()`, etc.
- Workaround: The account deletion anonymizes the email to `deleted-{userId}@deleted.invalid` and name to "Deleted User", so the record is somewhat inert. But it could still appear in instructor populates, enrollment lists, etc.

## Security Considerations

**ObjectId Validation Missing on Core Routes:**
- Risk: Several high-traffic routes under `app/api/courses/[id]/` pass the `id` param directly to `Course.findById(id)` without validating it's a valid MongoDB ObjectId. Invalid IDs cause Mongoose `CastError` exceptions that are caught as generic 500 errors.
- Files: All routes under `app/api/courses/[id]/` including:
  - `app/api/courses/[id]/route.ts`
  - `app/api/courses/[id]/enroll/route.ts`
  - `app/api/courses/[id]/modules/route.ts`
  - `app/api/courses/[id]/assignments/route.ts`
  - `app/api/courses/[id]/share/route.ts`
  - `app/api/courses/[id]/gradebook/route.ts`
- Current mitigation: The generic `catch` blocks return 500 errors, hiding the actual issue.
- Recommendations: Add `mongoose.Types.ObjectId.isValid(id)` checks at the start of each route handler that takes ID params. Return 400 for invalid IDs. The AI routes (`app/api/courses/ai/[courseId]/`) already do this correctly.

**File Serving Route Lacks Ownership Check:**
- Risk: Any authenticated user can access any uploaded file by guessing/knowing the submission ID and filename, even if they are not the student who uploaded it or the course instructor.
- Files: `app/api/files/[...path]/route.ts`
- Current mitigation: Files are served only to authenticated users, path traversal is prevented, and only `submissions` prefix is allowed. File paths include a random UUID component making them hard to guess.
- Recommendations: Cross-reference the submission's `student` field or course enrollment to verify the requesting user has permission to access the file.

**In-Memory Rate Limiting Does Not Survive Restarts:**
- Risk: The auth rate limiter in `middleware.ts` uses an in-memory `Map`. Restarting the server (or deploying) resets all rate limit counters.
- Files: `middleware.ts` (lines 11, 17-22)
- Current mitigation: The comment at line 13-16 acknowledges this limitation and notes Redis/MongoDB as a future path.
- Recommendations: For production with horizontal scaling, move to a shared rate limit store. For single-instance deployment, this is acceptable.

**Session Not Validated on Every Request:**
- Risk: JWT tokens cannot be revoked before expiry. If a user's session is deleted (e.g., via session management), the JWT remains valid until it expires (7 days).
- Files: `lib/auth/jwt.ts`, `lib/auth/middleware.ts`
- Current mitigation: The session model (`lib/models/Session.ts`) exists and sessions are created on login, but `authenticate()` only verifies the JWT signature -- it does not check if the session still exists in the database.
- Recommendations: Add an optional session validation check for sensitive operations (password change, account deletion, admin actions). Full session validation on every request would add latency.

## Performance Bottlenecks

**EnrolledStudents Array Scaling:**
- Problem: Enrolled students are stored as an array of ObjectIds directly on the Course document. Checking enrollment requires loading the entire array. Courses with many students will have large documents.
- Files: `lib/models/Course.ts` (line 56), all routes checking enrollment
- Cause: Array-based enrollment works for small class sizes but becomes inefficient at scale. Every enrollment check calls `.some()` on the full array.
- Improvement path: For large-scale use, move to a separate `Enrollment` collection with `{ courseId, studentId }` documents. Add a compound index. This is a significant schema change.

**Notification SSE Polling Hits MongoDB Every 5 Seconds:**
- Problem: The notification stream (`app/api/notifications/stream/route.ts`) polls MongoDB every 5 seconds for each connected client.
- Files: `app/api/notifications/stream/route.ts` (line 7, `POLL_INTERVAL_MS = 5_000`)
- Cause: No change stream or pub/sub mechanism. Direct polling.
- Improvement path: Use MongoDB change streams, or batch notification checks. Current approach works fine for low user counts. Connection auto-closes after 60 seconds (`MAX_DURATION_MS`), which limits damage.

**Gradebook Loads All Assignments Per Request:**
- Problem: The gradebook endpoint fetches all published assignments for a course plus submissions for all paged students in a single request.
- Files: `app/api/courses/[id]/gradebook/route.ts`
- Cause: Students are paginated, but all assignments are loaded without pagination. For courses with many assignments, this grows linearly.
- Improvement path: Add assignment pagination or summary-only mode.

**In-Memory Cache is Per-Instance:**
- Problem: `lib/cache.ts` uses an in-memory `Map` with a max of 1000 entries. Cache is not shared across serverless function instances or server restarts.
- Files: `lib/cache.ts`
- Cause: Simplest implementation for caching.
- Improvement path: For serverless deployments, this cache provides little benefit since each cold start gets a fresh cache. Consider Redis or removing the cache layer entirely if it is not providing measurable benefit.

## Fragile Areas

**AI Provider Resolution Chain:**
- Files: `lib/ai/utils/providerResolver.ts` (148 lines)
- Why fragile: The provider resolution has a complex priority chain (request > user preferences > course preferences > env vars > fallback). A change to any priority level can break the others. The tier system adds another dimension.
- Safe modification: Always run `lib/ai/utils/providerResolver.test.ts` after changes. The test file (163 lines) covers the main scenarios.
- Test coverage: Good unit test coverage, but integration tests for the full resolution chain through API routes are sparse.

**Queue Worker State Management:**
- Files: `lib/queue/worker.ts`
- Why fragile: Uses module-level `let running`, `let activeJobs`, and `let pollTimer` state. The retry logic uses `setTimeout` inside an async function. Stale job detection resets jobs to pending without checking if a worker is still actively processing them.
- Safe modification: The stale threshold (5 minutes) is generous, but if a legitimate long-running AI generation takes longer, the job could be reset and retried while still in progress.
- Test coverage: No tests for the worker. Changes are risky.

**Soft-Delete Inconsistency:**
- Files:
  - `lib/models/Course.ts` (has soft-delete filter)
  - `lib/models/Assignment.ts` (has soft-delete filter)
  - `lib/models/Submission.ts` (has soft-delete filter)
  - `lib/models/User.ts` (has `deletedAt` field, NO soft-delete filter)
  - `lib/models/Module.ts` (no `deletedAt` field at all)
  - `lib/models/Lesson.ts` (no `deletedAt` field at all)
- Why fragile: Three models have soft-delete, two related models do not. Deleting a course (soft) leaves its modules and lessons as normal documents. Hard-deleting a module orphans its lessons. The user model has the field but no filter.
- Safe modification: Any changes to deletion behavior must audit all related models. Use the admin trash route (`app/api/admin/trash/route.ts`) as a reference for correct cascade behavior.
- Test coverage: No dedicated soft-delete tests.

## Scaling Limits

**MongoDB `enrolledStudents` Array on Course:**
- Current capacity: Works well for class sizes under ~1000 students.
- Limit: MongoDB document size limit is 16MB. Each ObjectId is 12 bytes. Practical limit before performance degrades is several thousand students per course.
- Scaling path: Separate `Enrollment` collection with compound index `{ course: 1, student: 1 }`.

**Job Queue is Poll-Based:**
- Current capacity: Handles moderate job volume with 2 concurrent workers polling every 2 seconds.
- Limit: Under heavy load, the polling + `findOneAndUpdate` approach creates contention. Jobs can only be claimed one at a time per poll cycle (up to `MAX_CONCURRENT`).
- Scaling path: Move to a dedicated queue (BullMQ with Redis, already has `REDIS_URL` and `QUEUE_ENABLED` env vars defined in `lib/env.ts` but not yet implemented).

**Local File Storage:**
- Current capacity: Works for development and single-server deployment.
- Limit: Files stored at `data/uploads/` on the local filesystem. Not shared across instances. Lost on ephemeral deployments (Vercel, Docker without volumes).
- Scaling path: S3 storage provider exists (`lib/storage/s3.ts`) and can be activated via `STORAGE_PROVIDER=s3`. However, the file upload route (`app/api/courses/[id]/assignments/[assignmentId]/files/route.ts`) writes directly to disk instead of using the storage abstraction.

## Dependencies at Risk

**File Upload Route Bypasses Storage Abstraction:**
- Risk: `app/api/courses/[id]/assignments/[assignmentId]/files/route.ts` uses `writeFile` from `fs/promises` directly instead of the `FileStorage` interface from `lib/storage/`.
- Impact: Switching `STORAGE_PROVIDER=s3` will not affect file uploads for project submissions. They will always go to local disk.
- Migration plan: Refactor the file upload route to use `getStorage()` from `lib/storage/factory.ts`.

**`withTransaction` Silently Drops Sessions:**
- Risk: When a replica set is not available (standalone dev MongoDB), `withTransaction` catches the error and retries `fn(undefined as unknown as ClientSession)`. This means the "session" parameter is actually `undefined`, and any code using `{ session }` options will silently ignore it.
- Files: `lib/db.ts` (line 109)
- Impact: In development, operations that should be atomic are not. Data inconsistency bugs will only appear in production where transactions work.
- Migration plan: Log a warning when falling back to non-transactional mode. Consider requiring replica sets for development.

## Missing Critical Features

**No Middleware-Level Auth for API Routes:**
- Problem: The Next.js `middleware.ts` only checks for cookie presence on dashboard routes and applies rate limiting on auth endpoints. It does not verify JWT validity. All API routes individually call `authenticate(request)` and handle 401 responses themselves.
- Blocks: Cannot centrally enforce authentication or revoke access without touching every route.

**No Test Coverage for Most API Routes:**
- Problem: 50 API route files exist, but only 8 integration test files cover auth (login, register, me), courses (CRUD, enrollment), and assignments (CRUD, submissions). Zero tests for: quiz routes, file upload/download, AI generation, YouTube generation, notifications, sharing, gradebook, admin trash, user preferences, account deletion.
- Files: `__tests__/integration/` (8 test files)
- Blocks: Cannot confidently refactor API routes without risking regressions in untested behavior.

## Test Coverage Gaps

**Queue Worker and Job Handlers:**
- What's not tested: `lib/queue/worker.ts` and `lib/queue/handlers/aiGeneration.ts` (567 lines) have zero test coverage. Job processing, retry logic, stale job detection, and AI content generation flow are untested.
- Files: `lib/queue/worker.ts`, `lib/queue/handlers/aiGeneration.ts`, `lib/queue/handlers/youtubeGeneration.ts`
- Risk: The worker manages concurrent AI generation jobs with retry and error handling. Bugs here could cause stuck jobs, duplicate generations, or lost content.
- Priority: High

**Quiz System:**
- What's not tested: `app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts` (387 lines) has no integration tests. The quiz grader utility (`lib/utils/quizGrader.ts`) has unit tests, but the full quiz flow (start attempt, submit answers, time limit enforcement, shuffle, multiple attempts) is untested at the API level.
- Files: `app/api/courses/[id]/assignments/[assignmentId]/quiz/route.ts`
- Risk: Quiz grading, time limit enforcement, and attempt management are user-facing features with financial/academic implications.
- Priority: High

**File Upload/Download:**
- What's not tested: File upload, download, and deletion routes have no tests. Magic byte validation (`lib/utils/fileMagic.ts`) is also untested.
- Files: `app/api/courses/[id]/assignments/[assignmentId]/files/route.ts`, `app/api/files/[...path]/route.ts`
- Risk: File handling bugs could cause data loss or security issues.
- Priority: Medium

**Notification System:**
- What's not tested: SSE streaming, notification creation, mark-as-read, and the notification bell component.
- Files: `app/api/notifications/stream/route.ts`, `app/api/notifications/route.ts`, `app/api/notifications/[id]/route.ts`, `components/ui/NotificationBell.tsx`
- Risk: Broken notifications silently fail (stream errors are swallowed).
- Priority: Low

**Course Sharing:**
- What's not tested: Share course, list shares, remove shares. Share limit enforcement for students.
- Files: `app/api/courses/[id]/share/route.ts`
- Risk: Broken sharing could expose courses to unauthorized users or fail silently.
- Priority: Medium

**Account Deletion / Data Export:**
- What's not tested: Account deletion with data anonymization, and data export.
- Files: `app/api/users/me/delete/route.ts`, `app/api/users/me/export/route.ts`
- Risk: GDPR/privacy compliance features that are difficult to fix after launch.
- Priority: High

---

*Concerns audit: 2026-03-05*
