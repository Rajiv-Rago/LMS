# Domain Pitfalls

**Domain:** AI learning platform UX overhaul (dark mode, role simplification, inline feedback, public catalog)
**Researched:** 2026-03-06

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Tailwind CSS 4 Dark Mode Class Strategy Not Configured

**What goes wrong:** The app toggles a `.dark` class on `<html>` (see `app/layout.tsx` inline script and `app/(dashboard)/layout.tsx` `useDarkMode` hook), and every component uses `dark:` utility classes (e.g., `dark:bg-zinc-900`, `dark:text-white`). But `globals.css` has no `@custom-variant` or `@variant` directive telling Tailwind CSS 4 to use the class strategy. In Tailwind CSS 4, the `dark:` variant defaults to `@media (prefers-color-scheme: dark)` -- it does NOT automatically respond to a `.dark` class. This is why the dark mode toggle "exists but is non-functional" (PROJECT.md).

**Why it happens:** Tailwind CSS 3 used `darkMode: 'class'` in `tailwind.config.js`. Tailwind CSS 4 dropped config files and moved to CSS-first configuration. The migration carried over the class-toggle JavaScript without updating the CSS.

**Consequences:** Toggle appears to work (icon switches, localStorage saves) but has zero visual effect via the class. Users on a system with dark `prefers-color-scheme` get dark mode regardless of toggle state. Users on light systems never see dark mode even when toggled. All `dark:` utilities across 30+ component files are functionally dead for manual toggling.

**Prevention:** Add to `globals.css` right after `@import "tailwindcss"`:
```css
@custom-variant dark (&:where(.dark, .dark *));
```
This single line makes all existing `dark:` utilities respond to the `.dark` class on `<html>`.

**Detection:** Toggle dark mode. If backgrounds/text don't change but your OS dark mode works, the variant is misconfigured.

**Phase:** Dark mode fix (early -- blocks all visual polish work since you can't verify dark appearances).

**Confidence:** HIGH -- Verified against Tailwind CSS 4 official docs.

---

### Pitfall 2: CSS Variable Media Query Conflicts with Class-Based Toggle

**What goes wrong:** `globals.css` uses `@media (prefers-color-scheme: dark)` to set `--background` and `--foreground` CSS variables. After adding `@custom-variant dark`, there will be TWO dark mode systems: the media query for CSS variables AND the class for Tailwind utilities. If a user manually toggles to light mode while their OS is set to dark, the body background (from CSS variable, driven by OS preference) stays dark while Tailwind `dark:` classes switch to light.

**Consequences:** Mismatched colors -- body background in dark, component backgrounds in light. Broken visual hierarchy.

**Prevention:** Replace the media query in `globals.css` with a `.dark` class selector:
```css
/* REPLACE @media (prefers-color-scheme: dark) { :root { ... } } */
/* WITH: */
.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}
```
The inline script in `app/layout.tsx` already checks `matchMedia("(prefers-color-scheme:dark)")` as a fallback when no localStorage preference exists, so first-visit users still get the right theme.

**Detection:** Set OS to dark mode, toggle the app to light mode. If the body background stays dark, the media query is still active.

**Phase:** Dark mode fix (must be done alongside Pitfall 1).

---

### Pitfall 3: Role Simplification That Breaks API Authorization

**What goes wrong:** The UI simplification (removing teacher role from frontend) gets decoupled from the API-level role checks. The registration form still lets users pick "teacher" (`register/page.tsx` line 14). The `registerSchema` in `lib/validation/authSchemas.ts` still accepts `"teacher"`. API routes hard-gate on `user.role !== "teacher"` in 25+ locations (course creation, AI generation, content editing, module/lesson CRUD). If you remove teacher from the UI but new users register as "student" by default, they hit 403 errors on every course creation and AI generation attempt because those routes require `role === "teacher" || role === "admin"`.

**Why it happens:** The role system is deeply embedded -- it's in the JWT payload, the database model, 25+ API route checks, and the frontend conditionals. Simplifying "just the UI" feels safe but the API gates remain.

**Consequences:** Learners who register (as "student") cannot create courses, generate AI content, or edit content they own. The platform's core value proposition breaks.

**Prevention:**
1. **Do NOT just change the registration default role.** The underlying auth model needs updating.
2. Update API routes to check `course.owner === user.userId` (ownership-based auth) instead of `user.role === "teacher"`. The `courseOwnership.ts` utility already exists for this pattern.
3. Specific routes to update: `POST /api/courses/route.ts` (line 121), `POST /api/ai/generate/route.ts` (line 51), all module/lesson CRUD routes that check `course.instructor.toString() !== user.userId`.
4. For new course creation, allow any authenticated user. For course modification, check ownership.
5. Keep `role === "admin"` checks for admin-only operations.
6. Remove role dropdown from registration, default to "student", hard-code server-side in `registerSchema`.

**Detection:** Register a new account (as student), try to create a course or generate AI content. If you get a 403, the route still gates on teacher role.

**Phase:** Role simplification (must happen before or alongside public catalog, because the catalog implies any user can create and learn).

---

### Pitfall 4: Making Content Public Without Access Control Audit

**What goes wrong:** The GET `/api/courses` route already allows unauthenticated users to see `isPublished: true` courses. But individual course detail, lesson, assignment, and quiz routes ALL require authentication via `authenticate(request)`. Making a "public catalog" without updating these downstream routes means users can browse the catalog but cannot view any course content, lessons, or modules.

**Why it happens:** "Public catalog" feels like a single feature (list courses publicly) but actually requires a cascade of access changes across course detail, module list, lesson detail, and enrollment routes.

**Consequences:** Public catalog shows courses but clicking any course 404s or 401s for unauthenticated users. Or worse -- you make routes unauthenticated but forget to scope which content is visible, leaking unpublished/draft content.

**Prevention:**
1. Map every route in the course-viewing chain: catalog -> course detail -> module list -> lesson detail. Each needs an "allow if published" path for unauthenticated users.
2. Distinguish clearly between "viewing" (public, no auth for published) and "interacting" (enrollment, submissions, quiz attempts -- require auth).
3. Create a utility `allowPublicIfPublished(course)` that returns the course for published content without requiring auth, blocking draft/private content.
4. Test the full unauthenticated flow: land on catalog -> click course -> view lesson -> hit "enroll" (which then prompts login).
5. Store the intended URL for redirect after login.

**Detection:** Open an incognito window and navigate to a course URL. If you get redirected to login before seeing any content, the public access chain is broken.

**Phase:** Public catalog (after role simplification, since the access model depends on ownership semantics being clear).

---

### Pitfall 5: Inline Feedback Without Content Versioning

**What goes wrong:** The current regeneration flow (`POST /api/courses/ai/[courseId]/lessons/[lessonId]/generate`) accepts `feedback` text, passes it to the LLM with `previousContent` (see `lib/ai/services/lessonContentGenerator.ts` lines 128-137), and overwrites the lesson's `content` field. There is no version history. If the LLM produces worse content in response to feedback, the good content is gone permanently.

**Why it happens:** The simplest implementation is "replace and save." Versioning seems like over-engineering. But once users start giving feedback on AI content, they expect to undo bad regenerations.

**Consequences:** User gives feedback like "make this simpler." LLM strips detail and produces shallow content. User has objectively worse content with no way to recover. This trains users NOT to give feedback (killing the core differentiator).

**Prevention:**
1. Before overwriting, save the current `content` to a `contentHistory` array on the Lesson model (cap at 3-5 versions).
2. Store each version with: `{ content, feedback, generatedAt, provider }`.
3. Add a "revert" button in the UI next to the feedback form.
4. At ~10KB per lesson, 5 versions = ~50KB -- well within MongoDB document limits.

**Detection:** Generate content, give feedback, get worse content. No undo button = this pitfall is live.

**Phase:** Inline feedback (build versioning together with the feedback UI, not after).

## Moderate Pitfalls

### Pitfall 6: UX Overhaul Regression in Monolithic Page Components

**What goes wrong:** `app/(dashboard)/courses/[id]/page.tsx` is 1152 lines with 23+ state variables managing course display, module CRUD, lesson CRUD, AI generation, model selection, and enrollment in one component. Any UX changes risk breaking existing functionality. The lesson detail page (710 lines) and assignment page (516 lines) have similar issues.

**Why it happens:** Incremental changes feel faster than decomposition. "I'll just add one more useState" compounds.

**Consequences:** Bugs in enrollment, AI generation, or module management that are hard to isolate. Merge conflicts. Visual regressions from unrelated state changes.

**Prevention:**
1. **Decompose before polishing.** Extract `ModuleList`, `LessonItem`, `AIGenerationPanel`, `CourseHeader` (CONCERNS.md already recommends this).
2. Extract custom hooks: `useModuleManagement`, `useAIGeneration`, `useCourseData`.
3. Only then apply UX changes to the smaller, isolated components.

**Detection:** If a UX change in the course detail page requires reading 200+ lines of context to understand, decomposition was skipped.

**Phase:** Prerequisite task before the visual polish phase.

---

### Pitfall 7: Public Catalog SEO Without Server-Side Rendering

**What goes wrong:** Every dashboard page is client-rendered (`"use client"` at the top, data fetched in `useEffect`). For a public catalog to drive organic discovery, search engines need to index course titles and descriptions. Client-rendered content is not reliably indexed.

**Consequences:** Public catalog exists but generates zero organic traffic. Shareable links show a loading spinner in link previews (Slack, Discord, Twitter) instead of course title and description.

**Prevention:**
1. Public catalog page should be a Server Component that fetches published courses directly from the database.
2. Public course detail pages should use server-side data fetching for basic info (title, description, module list), with client-side interactivity only for enrollment/feedback.
3. Add `generateMetadata()` to public course pages for proper `<title>`, `og:title`, `og:description` tags.

**Detection:** View page source on a public course page. If the course title is not in the HTML, SSR is missing.

**Phase:** Public catalog (first-class requirement, not an enhancement).

---

### Pitfall 8: Feedback Spam and LLM Cost Explosion

**What goes wrong:** Inline feedback triggers a full lesson regeneration via LLM. Each costs API credits. Without per-lesson rate limiting, a user could spam feedback and burn through LLM budget. The existing `enforceAIRateLimit` is user-level credit-based, which may be too generous for repeated single-lesson regenerations.

**Prevention:**
1. Add a per-lesson cooldown (e.g., 60 seconds between feedback submissions for the same lesson).
2. Show regeneration count: "2 of 5 regenerations used on this lesson."
3. Track regeneration count on the Lesson model to enable limits.
4. Consider batching feedback (user flags multiple issues, one regeneration addresses all).

**Detection:** Monitor LLM API costs after launching feedback. If a single user triggers 10+ regenerations in an hour, safeguards are insufficient.

**Phase:** Inline feedback.

---

### Pitfall 9: Typography Plugin Dark Mode Inconsistency

**What goes wrong:** `MarkdownContent.tsx` uses `prose dark:prose-invert` from `@tailwindcss/typography`. After fixing the dark variant (Pitfall 1), the prose styles may not fully invert if `@custom-variant dark` is declared after `@plugin "@tailwindcss/typography"` in `globals.css`. Custom `code`/`pre` styles with hardcoded `dark:bg-zinc-800` can also clash with `prose-invert` defaults.

**Consequences:** Lesson content (the core learning material) has inconsistent colors in dark mode -- some text inverts, code blocks don't, links stay invisible against dark backgrounds.

**Prevention:**
1. Declare `@custom-variant dark` BEFORE `@plugin "@tailwindcss/typography"` in `globals.css`.
2. After fixing, visually audit every markdown element type: headings, paragraphs, code blocks (inline and fenced), blockquotes, tables, lists, links.
3. Test with actual AI-generated lesson content which uses headers, code blocks, and lists heavily.

**Detection:** Generate a lesson with code examples, view in dark mode. If code blocks are light-on-light or links are invisible, the plugin isn't inverting correctly.

**Phase:** Dark mode fix (test immediately after variant fix).

---

### Pitfall 10: Over-Scoping Inline Feedback to Section-Level

**What goes wrong:** Building section-level inline feedback (click a paragraph, regenerate just that section) before validating the simpler lesson-level approach. Section-level requires content addressing, diff/merge for partial regeneration, and selection UI. This is 5-10x more complex.

**Why it happens:** It sounds better in the product vision. But the existing regeneration pipeline works at the lesson level, and the lesson page already has `showFeedback` state and `handleGenerate(withFeedback)`.

**Prevention:** Polish the existing lesson-level feedback flow first. The API, job handler, and LLM prompt already support `feedback` + `previousContent`. Only build section-level if user testing reveals explicit demand for more granularity.

**Phase:** Inline feedback (resist scope creep).

## Minor Pitfalls

### Pitfall 11: Removing Teacher UI Leaves Orphaned Conditional Text

**What goes wrong:** Dashboard page has 14+ instances of `user?.role === "teacher" ? "Your Courses" : "Enrolled Courses"`. Courses page, assignment page, and layout have similar conditionals. Removing teacher from UI without auditing these leaves dead code branches or wrong labels.

**Prevention:** Search all `teacher` references in `app/(dashboard)/` (20+ instances across `dashboard/page.tsx`, `courses/page.tsx`, `courses/[id]/assignments/page.tsx`, `layout.tsx`). Replace with learner-appropriate labels. Remove role dropdown from registration page.

**Phase:** Role simplification.

---

### Pitfall 12: Enrollment Race Condition Amplified by Public Catalog

**What goes wrong:** The existing enrollment race condition (CONCERNS.md) uses array `push` instead of `$addToSet`. With a public catalog driving more concurrent traffic, double-enrollment probability increases.

**Prevention:** Fix enrollment route to use `$addToSet` instead of manual check-then-push. One-line fix, should happen before public catalog launch.

**Phase:** Bug audit (prerequisite for public catalog).

---

### Pitfall 13: Shareable Course Links Without Open Graph Metadata

**What goes wrong:** When shared on Slack, Discord, or Twitter, course links show no preview (no title, description, or image) because pages are client-rendered without `og:*` meta tags.

**Prevention:** Add `generateMetadata()` to public course pages returning `og:title`, `og:description`, `og:image`. Use `coverImage` field or generate a placeholder.

**Phase:** Public catalog / shareable links.

---

### Pitfall 14: FOUC Protection Already Exists -- Do Not Remove It

**What goes wrong:** The inline `<script>` in `app/layout.tsx` prevents flash of unstyled content by applying `.dark` class before React hydrates. The `suppressHydrationWarning` on `<html>` prevents React from complaining about the mismatch. Developers unfamiliar with this pattern may remove either, reintroducing FOUC.

**Prevention:** Keep the inline script and `suppressHydrationWarning`. Both are intentional and correct. Add a brief comment explaining their purpose if not already documented.

**Phase:** Dark mode fix (preservation, not new work).

---

### Pitfall 15: Soft-Delete Inconsistency Exposed by Public Catalog

**What goes wrong:** Courses have soft-delete filters (pre-find hook excludes `deletedAt !== null`). Modules and Lessons have NO `deletedAt` field or soft-delete filter (per CONCERNS.md). Public catalog queries that join content could surface orphaned lessons from soft-deleted courses if querying lessons directly.

**Prevention:** Ensure public catalog queries always start from the Course model (which has the soft-delete filter) and populate modules/lessons through references, never querying lessons directly without a course scope.

**Phase:** Public catalog (awareness when designing queries).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Dark mode fix | `@custom-variant dark` not configured (Pitfall 1) | Single CSS line fix. Test immediately with toggle. |
| Dark mode fix | CSS variable media query conflict (Pitfall 2) | Change `@media` to `.dark` selector in globals.css. |
| Dark mode fix | Typography dark mode (Pitfall 9) | Order `@custom-variant` before `@plugin` in globals.css. Audit prose rendering. |
| Dark mode fix | FOUC script removal (Pitfall 14) | Preserve existing inline script and suppressHydrationWarning. |
| Role simplification | API 403s for students (Pitfall 3) | Audit all 25+ API route role checks. Switch to ownership-based auth. |
| Role simplification | Orphaned teacher text (Pitfall 11) | Search and replace all `teacher` conditionals in frontend. |
| Inline feedback | No content versioning (Pitfall 5) | Build history into Lesson model alongside feedback UI. |
| Inline feedback | Cost explosion (Pitfall 8) | Per-lesson cooldowns and regeneration caps. |
| Inline feedback | Over-scoping to section-level (Pitfall 10) | Polish existing lesson-level feedback first. |
| Public catalog | Access control cascade (Pitfall 4) | Audit full viewing chain from catalog to lesson. |
| Public catalog | No SSR for SEO (Pitfall 7) | Build public pages as Server Components with generateMetadata. |
| Public catalog | Enrollment race condition (Pitfall 12) | Fix to `$addToSet` before launch. |
| Public catalog | Soft-delete gaps (Pitfall 15) | Always query through Course model for public content. |
| Shareable links | No OG metadata (Pitfall 13) | Add generateMetadata() to public course pages. |
| Visual polish | Monolithic components (Pitfall 6) | Decompose before polishing. |

## Sources

- Tailwind CSS 4 dark mode docs: https://tailwindcss.com/docs/dark-mode -- verified `@custom-variant` syntax (HIGH confidence)
- Codebase analysis: `app/globals.css`, `app/layout.tsx`, `app/(dashboard)/layout.tsx` -- dark mode implementation (HIGH confidence)
- Codebase analysis: `lib/auth/middleware.ts`, `lib/auth/courseOwnership.ts`, 25+ API route files -- role system (HIGH confidence)
- Codebase analysis: `lib/ai/services/lessonContentGenerator.ts`, `lib/queue/handlers/aiGeneration.ts`, `app/api/courses/ai/[courseId]/lessons/[lessonId]/generate/route.ts` -- feedback/regeneration flow (HIGH confidence)
- Codebase analysis: `app/api/courses/route.ts`, `lib/models/Course.ts` -- public access model (HIGH confidence)
- `.planning/codebase/CONCERNS.md` -- enrollment race condition, monolithic components, auth patterns, soft-delete gaps (HIGH confidence)
- `.planning/PROJECT.md` -- active requirements, constraints (HIGH confidence)
- Next.js App Router documentation -- Server Components vs Client Components for SEO (HIGH confidence)

---

*Pitfalls audit: 2026-03-06*
