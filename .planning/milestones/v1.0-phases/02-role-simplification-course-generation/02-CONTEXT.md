# Phase 2: Role Simplification & Course Generation - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Any authenticated user can generate a hybrid AI+YouTube course from the dashboard without needing a teacher role. This phase removes the teacher/student distinction from the UI, replaces role-based API authorization with ownership-based checks, and builds a unified course generation flow that combines AI text lessons and YouTube video lessons into a single experience. Registration loses its role selector. The dashboard becomes the primary entry point for course generation.

</domain>

<decisions>
## Implementation Decisions

### Generation entry point
- Inline text input directly on the dashboard — no navigation to a separate page
- Input bar styled like a search bar: "What do you want to learn?" with a Generate button
- Topic input + skill level selector (Beginner / Intermediate / Advanced) — that's it
- No model selector, no duration field, no additional context — server uses default AI provider/model
- Truly 2-click: type topic, hit Generate

### Unified generation flow
- AI decides which lessons should be text and which should be YouTube videos based on the topic
- No user choice for text vs video mix — fully autonomous
- Single backend flow merging the existing AI syllabus and YouTube path generation systems
- Both systems already set `owner` field and `isPublished: true` — pattern is consistent

### Generation progress & completion
- After hitting Generate, a progress indicator appears on the dashboard (generating card with status)
- User can keep browsing while generation runs
- When generation completes, auto-redirect to the new course page
- Existing job polling pattern (`/api/jobs/{jobId}` every 2 seconds) is reusable

### Generation limits
- Hard limit of 5 courses per user (total generated, not per-session)
- Until pricing tiers are added, this prevents runaway AI costs
- Clear messaging when limit is reached

### Dashboard layout
- Two sections: "My Courses" (generated) at top, "Enrolled Courses" below
- Clear visual separation between generated and enrolled courses
- Course cards show: title, progress bar (% complete), lesson count
- Progress-focused stats: lessons completed, courses in progress, completion percentages
- No teacher-centric stats (no "Total Students" count)

### Dashboard empty state
- Generation-focused welcome for new users
- Input bar front and center with welcoming message ("Start learning anything" or similar)
- 3-4 topic suggestion chips the user can click to auto-fill the topic input

### Role cleanup — user accounts
- Role field stays in the database but UI treats everyone the same
- Existing teacher accounts continue working — no migration needed
- Registration page: remove the Student/Teacher role dropdown entirely
- All new users register without role selection (default to student in DB)

### Role cleanup — traditional course creation
- Traditional course creation page (`/courses/new`) restricted to admin role only
- ROLE-04 satisfied: admin retains manual creation and editing
- Regular users only use the AI generation flow from the dashboard

### Role cleanup — API authorization
- Full cleanup: replace ALL teacher role checks with ownership-based checks
- Any authenticated user can do what teachers could do on their own courses (owner/instructor)
- Admin retains full access to all courses
- Use existing `checkCourseOwnership()` and `canModifyOwnedCourse()` helpers from `lib/auth/courseOwnership.ts`

### Sidebar navigation
- Keep as-is: Dashboard, My Courses, Profile, Settings
- No new items needed — dashboard is the generation hub

### Claude's Discretion
- Exact implementation of the unified AI+YouTube generation pipeline
- How to merge the two separate job handlers into one flow
- Progress indicator design on the dashboard
- How to implement the 5-course limit (DB field vs query count)
- Topic suggestion chip content and selection logic
- Skill level UI treatment (buttons, segmented control, or pills)

</decisions>

<specifics>
## Specific Ideas

- The inline generation input should feel like a search bar — immediate, inviting, low-friction
- Topic suggestion chips for empty state help users who don't know what to type
- "5 courses max" is a temporary constraint until pricing tiers exist — should be easy to change later

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ModelSelector` component (`components/ai/ModelSelector.tsx`): Not needed in new flow (hidden from users), but admin creation page can keep it
- Job polling pattern: Both AI and YouTube flows return `{ jobId }` with 202 status, client polls `/api/jobs/{jobId}` — reuse for unified flow
- `checkCourseOwnership()` / `canModifyOwnedCourse()` / `canAccessOwnedCourse()` (`lib/auth/courseOwnership.ts`): Ready-made ownership auth helpers
- AI generation page (`app/(dashboard)/courses/new/ai/page.tsx`): Reference for form patterns and job polling UI
- `SyllabusGeneratorService` / `YouTubePathService`: Both services exist and work — need orchestration layer
- `enforceAIRateLimit()`: Existing rate limiter to build on for the 5-course limit

### Established Patterns
- Course `owner` field distinguishes AI-generated courses from instructor-created ones
- Both generation flows set `owner: userId` and `isPublished: true`
- Dashboard uses role-conditional rendering (`user.role === "teacher"`) — needs replacing with unified layout
- Gradient styling: AI uses `from-indigo-600 to-violet-600`, YouTube uses `from-red-600 to-indigo-600`

### Integration Points
- `app/(dashboard)/dashboard/page.tsx`: Main dashboard — needs inline generation input + two-section layout
- `app/(auth)/register/page.tsx`: Role dropdown removal
- `lib/validation/authSchemas.ts`: Remove role from registration schema
- `app/api/courses/route.ts` (POST): Currently role-gated to teacher/admin — needs ownership-based check
- 25+ API routes checking `role === "teacher"`: Full enumeration needed during research/planning
- `app/(dashboard)/courses/new/ai/page.tsx`: Existing AI generation page — may be removed or kept as admin-only
- YouTube generation has API endpoint but NO UI page — new unified flow replaces the need for one

</code_context>

<deferred>
## Deferred Ideas

- Pricing tiers to replace the hard 5-course limit — future milestone
- Additional context / preferences field for generation — add when needed
- Model selection for power users — future feature

</deferred>

---

*Phase: 02-role-simplification-course-generation*
*Context gathered: 2026-03-06*
