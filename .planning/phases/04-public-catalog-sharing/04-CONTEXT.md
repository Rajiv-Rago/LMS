# Phase 4: Public Catalog & Sharing - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Anyone on the internet can discover courses, preview them, and enroll via a shareable link. This phase adds a public catalog page at `/explore`, a public course detail page with syllabus preview, a Google Docs-style three-tier access model (Restricted / Anyone with the link / Published to catalog), Open Graph metadata for link previews, and post-auth auto-enrollment. Courses are private by default — owners control visibility.

</domain>

<decisions>
## Implementation Decisions

### Course access model (Google Docs-style)
- Three-tier access controlled by the course owner:
  - **Restricted** (default) — Only the owner and explicitly added people can access
  - **Anyone with the link** — Anyone with the direct URL can view and enroll, but the course doesn't appear in catalog search
  - **Published to catalog** — Listed publicly in `/explore` search (implies "anyone with the link" too)
- Courses are **private by default** (change `isPublished` default from `true` to `false`)
- Share controls live on the course detail page (not a separate manage page)
- Dropdown for access level + "Add people" input + "Copy link" button — modeled after Google Docs sharing dialog

### Catalog presentation
- Card grid layout: 3 columns desktop, 2 tablet, 1 mobile
- Each card shows: cover image (or fallback), title, description snippet, lesson count, enrollment count
- Default sort: most enrolled first (social proof)
- Hero search bar at the top: large input with heading "Explore courses"
- Pagination: "Load more" button (12 courses per page), not infinite scroll
- Empty search state: "No courses found for 'X'. Be the first to create one!" with CTA to sign up/dashboard

### Pre-enrollment preview
- Syllabus preview visible to unauthenticated visitors: module names, lesson titles with type icons, quiz indicators
- Lesson type icons: text lessons get a document icon, YouTube lessons get a video icon, quizzes get a quiz icon
- Lesson content is strictly locked — clicking a lesson shows "Enroll to access this lesson"
- Enrollment count shown as social proof ("45 learners enrolled")
- Creator attribution: "Created by [Name] with AI" for AI-generated, "Created by [Name]" for admin-created
- Skill level badge displayed when available (from youtubeMetadata.skillLevel)
- Auto-enroll after auth: store course ID in URL param (e.g., `/login?enroll=courseId`), auto-enroll + redirect after login/register

### Navigation & entry
- Public catalog lives at `/explore`
- Landing page: secondary CTA "Browse Courses" alongside primary "Get Started" button
- Dashboard sidebar: add "Explore" link for authenticated users
- `/explore` hides courses the logged-in user already owns or is enrolled in (those are on dashboard)
- Public pages use minimal header: logo + "Sign in" / "Get Started" buttons (no sidebar)

### Open Graph & sharing
- Shareable URL = public detail page URL (`/courses/[id]`)
- Static branded Kantigo OG image: indigo gradient background with course title overlaid
- OG description: first 150 characters of course description
- "Copy link" button on course detail page with toast confirmation
- `generateMetadata()` on the public course detail page for per-course OG tags

### Claude's Discretion
- Card cover image fallback design (gradient with initial, plain gradient, or no image area)
- Exact share dialog component design and positioning on the course detail page
- How to implement the three-tier access model in the database (new field vs. repurposing isPublished)
- Loading skeleton designs for catalog and course detail pages
- Search debounce timing and behavior
- How to handle the "Add people" sharing UX (email input, autocomplete, etc.)

</decisions>

<specifics>
## Specific Ideas

- "The main goal is courses for personal use. Explore is mostly for sharing courses with friends, and maybe occasionally monetizing — but that's out of scope."
- Google Docs-style sharing dialog: dropdown with Restricted / Anyone with the link / Published, people list with roles, copy link button
- "Explore shouldn't show courses they're already enrolled in. Enrolled or owned courses should be on their dashboard."

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GET /api/courses`: Already supports unauthenticated requests, text search, pagination, and caching (30-second TTL for public listings)
- `GET /api/courses/[id]`: Already has optional auth and returns permissions object with `canEdit`, `canEnroll`, `isEnrolled`
- `CourseSection` component (`components/dashboard/CourseSection.tsx`): Reusable course card grid with title, description, lesson count
- `Enrollment` model: `isEnrolled()`, `getEnrollmentCount()` methods ready to use
- `getCoursePermissions()` (`lib/auth/coursePermissions.ts`): Unified permission checking with `canEdit`, `canView`, `isEnrolled` flags
- `ShareDialog` component (`components/course/ShareDialog.tsx`): Existing sharing dialog — may need redesign for Google Docs-style UX
- `parsePagination()` utility: Existing pagination helper
- `cache` module (`lib/cache.ts`): Public listing caching with prefix invalidation
- Toast component (`components/ui/Toast.tsx`): For "Link copied" confirmation

### Established Patterns
- Optional auth: `authenticate()` returns null if no token — branch logic based on `if (user)`
- Public pages: `app/page.tsx` lives outside route groups — pattern for public routes
- MongoDB text index on Course `{ title: "text", description: "text" }` — search is already indexed
- Course visibility: `isPublished` boolean field with index `{ isPublished: 1 }`
- `sharedWith` array on Course model for explicit user sharing
- CSRF: only checked on mutation methods (POST, PUT, PATCH, DELETE) — GET routes safe for public access

### Integration Points
- `app/page.tsx`: Landing page — add "Browse Courses" secondary CTA
- `app/(dashboard)/layout.tsx`: Sidebar — add "Explore" navigation link
- `lib/models/Course.ts`: Change `isPublished` default, potentially add access level field
- `app/api/courses/[id]/enroll/route.ts`: Enrollment endpoint — already works, needs to be reachable post-auth redirect
- `app/(auth)/login/page.tsx` and `register/page.tsx`: Handle `?enroll=courseId` param for auto-enrollment after auth
- New public route group or root-level pages needed for `/explore` and `/courses/[id]` (public detail)

</code_context>

<deferred>
## Deferred Ideas

- Share a course as a template that the recipient generates their own copy of (spending their tokens) — new generation flow, its own phase
- Course categories/tags for filtered browsing (CATL-05, v2)
- Popular/trending courses section (CATL-06, v2)
- Course rating system (CATL-07, v2)
- Monetization for course creators — future milestone

</deferred>

---

*Phase: 04-public-catalog-sharing*
*Context gathered: 2026-03-07*
