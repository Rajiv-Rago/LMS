# Project Research Summary

**Project:** Kantigo UX Polish Milestone
**Domain:** AI-powered learning platform -- UX overhaul (dark mode, role simplification, inline feedback, public catalog)
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

This milestone is a UX polish pass on an existing brownfield Next.js 16 / React 19 / Tailwind CSS 4 application. The stack is established and sound -- no new dependencies are needed. The single highest-impact fix is a one-line CSS directive (`@custom-variant dark`) that unblocks the entire dark mode system, which currently has full infrastructure (toggle hook, FOUC script, `dark:` classes on 30+ components) but zero visual effect because Tailwind CSS 4 defaults to media-query-based dark mode, not class-based. Every other visual polish task depends on this fix.

The recommended approach is to sequence work in strict dependency order: fix dark mode CSS first (unblocks all visual verification), then simplify the role system from teacher/student to ownership-based auth (unblocks course creation for all users), then decompose monolithic page components (de-risks all subsequent UI work), then build the public catalog with SSR (unblocks discovery and sharing), then polish inline feedback with content versioning (the core differentiator). No new libraries, no new infrastructure. The entire milestone is achievable with the existing stack plus CSS changes, React 19 hooks (`useOptimistic`, `useTransition`), and MongoDB text indexes.

The key risks are: (1) role simplification touching 25+ API routes that hard-gate on `teacher` role -- incomplete migration means students cannot create courses, breaking the core value proposition; (2) public catalog requiring a cascade of access control changes across the full viewing chain (catalog -> course detail -> module list -> lesson detail), not just a single "public" page; and (3) inline feedback regeneration overwriting content without versioning, which trains users NOT to give feedback. All three are preventable with careful sequencing and the specific mitigations identified in research.

## Key Findings

### Recommended Stack

No new dependencies. The existing stack (Next.js 16, React 19, Tailwind CSS 4, MongoDB/Mongoose 8) covers every need. The research explicitly recommends AGAINST adding `next-themes` (redundant -- toggle infrastructure already exists), Framer Motion (overkill -- CSS transitions suffice), `shadcn/ui` or Radix (creates mid-project inconsistency), and external search services (MongoDB text index is sufficient at current scale).

**Core technologies (all already installed):**
- **Tailwind CSS 4 `@custom-variant`**: Enable class-based dark mode -- one CSS line fixes all `dark:` utilities across 30+ files
- **React 19 `useOptimistic` / `useTransition`**: Optimistic UI for feedback submissions and non-blocking regeneration state
- **MongoDB text indexes**: Course search for public catalog without external search infrastructure
- **Next.js Server Components + `generateMetadata()`**: SSR for public catalog pages (SEO, OG tags, link previews)

See [STACK.md](./STACK.md) for full rationale and configuration details including the exact `globals.css` changes needed.

### Expected Features

**Must have (table stakes):**
- Working dark/light mode toggle (broken today -- CSS fix)
- Consistent dark mode across all pages including auth pages
- Course catalog / browse page for discovery
- Dashboard "Create Course" entry point (AI generation not accessible from dashboard)
- Responsive design polish (inconsistent padding/overflow on mobile)
- Standardized loading states (skeleton screens instead of mixed spinners/blanks)

**Should have (differentiators):**
- Inline lesson feedback with regeneration (exists but needs UX polish)
- Shareable course links with instant enrollment (viral growth)
- Two-click course generation from dashboard
- Smooth theme transitions (CSS `transition-colors`)
- System theme detection with manual override (three-way toggle)

**Defer (v2+):**
- Section-level paragraph feedback (5-10x complexity over lesson-level; validate demand first)
- Semantic CSS color tokens (maintainability improvement, not user-visible)
- Syntax highlighting in code blocks (only matters for programming courses)
- Full theme customization, animated page transitions, component library migration

See [FEATURES.md](./FEATURES.md) for full feature landscape and dependency map.

### Architecture Approach

The existing architecture requires no structural changes. The key patterns to follow are: CSS-first dark mode via `@custom-variant` (not React state, which causes FOUC), optimistic feedback UI using React 19 hooks, server-side catalog rendering with client-side search enrichment, and extending the existing courses API with visibility parameters rather than creating separate public endpoints. The critical anti-patterns to avoid are: putting theme state in React Context (breaks pre-hydration), dynamically constructing Tailwind classes (causes purging), and building separate public/private API routes (causes drift).

**Major components affected:**
1. **`globals.css`** -- Dark mode directive and CSS variable migration from media query to class selector
2. **Auth pages layout** (`app/(auth)/layout.tsx`) -- Add dark mode classes (currently hardcoded light)
3. **API route authorization** (25+ files) -- Migrate from role-based (`teacher`) to ownership-based auth
4. **Public catalog** (new) -- Server Component with `generateMetadata()`, MongoDB text index, enrollment flow
5. **Lesson feedback UI** (existing) -- Add content versioning, optimistic states, regeneration limits

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed patterns, data flows, and scalability considerations.

### Critical Pitfalls

1. **Dark mode CSS misconfiguration** -- The `@custom-variant dark` directive is missing from `globals.css`, making all `dark:` utilities dead for class-based toggling. Fix: one CSS line. Must also replace the `@media (prefers-color-scheme: dark)` block with a `.dark` class selector to avoid dual dark-mode systems conflicting.

2. **Role simplification breaking API authorization** -- 25+ API routes hard-gate on `user.role === "teacher"`. Removing teacher from UI without updating these routes means students hit 403 on course creation, AI generation, and all content editing. Fix: migrate to ownership-based auth using the existing `courseOwnership.ts` utility.

3. **Public catalog without access control cascade** -- Making a catalog page is not a single feature; it requires updating the entire viewing chain (catalog -> course detail -> module list -> lesson detail) to allow unauthenticated access for published content. Without this, users can browse but cannot click into any course.

4. **Inline feedback without content versioning** -- Regeneration overwrites content permanently. Bad LLM output destroys good content with no undo. Fix: add `contentHistory` array to Lesson model (capped at 3-5 versions) alongside the feedback UI, not after.

5. **Monolithic page components** -- Course detail page is 1152 lines with 23+ state variables. UX changes in these files risk breaking existing functionality. Fix: decompose into smaller components before applying visual polish.

See [PITFALLS.md](./PITFALLS.md) for all 15 pitfalls with detection strategies and phase-specific warnings.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Dark Mode Fix
**Rationale:** Unblocks all visual work. Every subsequent phase needs dark mode working to verify appearances. One-line CSS fix with high confidence, low risk. Do this first and immediately.
**Delivers:** Working dark/light toggle across entire app, smooth theme transitions, dark mode on auth pages, dark prose rendering in markdown content.
**Addresses:** Table stakes (working toggle, consistent dark mode), differentiator (smooth transitions, system detection).
**Avoids:** Pitfall 1 (CSS variant), Pitfall 2 (media query conflict), Pitfall 9 (typography ordering), Pitfall 14 (preserve FOUC script).

### Phase 2: Role Simplification
**Rationale:** Must happen before public catalog because the catalog implies any user can create and learn. The access model depends on ownership semantics being clear. Touching 25+ API routes is the riskiest work in this milestone -- do it early when the blast radius is contained.
**Delivers:** Any authenticated user can create courses, ownership-based authorization, simplified registration (no role dropdown), cleaned-up frontend conditionals.
**Addresses:** Prerequisite for table stakes (dashboard create course entry point, public catalog).
**Avoids:** Pitfall 3 (403 errors for students), Pitfall 11 (orphaned teacher text).

### Phase 3: Component Decomposition
**Rationale:** The 1152-line course detail page and 710-line lesson page are too risky to polish as monoliths. Decomposing before visual polish prevents regressions and makes subsequent phases safer. This is prep work, not user-visible, but it de-risks everything after.
**Delivers:** Extracted `ModuleList`, `LessonItem`, `AIGenerationPanel`, `CourseHeader` components. Custom hooks for module management, AI generation, course data.
**Addresses:** Prerequisite for all visual polish and inline feedback work.
**Avoids:** Pitfall 6 (monolithic component regressions).

### Phase 4: Public Catalog and Shareable Links
**Rationale:** Depends on role simplification (Phase 2) being complete so any user can enroll and create. Requires SSR for SEO -- must be built as Server Components from the start, not retrofitted.
**Delivers:** Public course catalog with search/filter, shareable course URLs with OG metadata, enrollment from catalog, redirect-after-login flow.
**Addresses:** Table stakes (course catalog, discovery), differentiator (shareable links, instant enrollment).
**Avoids:** Pitfall 4 (access control cascade), Pitfall 7 (no SSR), Pitfall 12 (enrollment race condition -- fix `$addToSet` first), Pitfall 13 (no OG metadata), Pitfall 15 (soft-delete gaps).

### Phase 5: Inline Feedback Polish
**Rationale:** Depends on component decomposition (Phase 3) so feedback UI changes are isolated. The regeneration pipeline already works at lesson level -- this phase polishes the UX and adds versioning, not new core functionality.
**Delivers:** Content versioning with revert, optimistic regeneration UI, visible feedback form (not hidden in accordion), per-lesson rate limiting, regeneration count display.
**Addresses:** Differentiator (inline feedback with regeneration -- core product differentiator).
**Avoids:** Pitfall 5 (no versioning), Pitfall 8 (cost explosion), Pitfall 10 (over-scoping to section-level).

### Phase 6: Visual Polish and Loading States
**Rationale:** Final pass after all functional work is complete. Polish is wasted if applied to code that gets restructured. Depends on decomposed components (Phase 3) and working dark mode (Phase 1).
**Delivers:** Standardized skeleton loading, responsive design fixes, dashboard create-course CTA, consistent spacing and overflow handling on mobile.
**Addresses:** Table stakes (loading states, responsive polish, dashboard entry point).
**Avoids:** Pitfall 6 (polishing monoliths).

### Phase Ordering Rationale

- **Dark mode first** because it is a one-line fix that unblocks visual verification for every other phase. You cannot confirm dark mode appearances until this works.
- **Role simplification second** because it touches the authorization layer that the public catalog depends on. Getting this wrong means students cannot use the platform's core features.
- **Component decomposition third** because it de-risks all subsequent UI work. Modifying 1000+ line files for visual polish is asking for regressions.
- **Public catalog fourth** because it is the biggest new feature, depends on role simplification, and has the most pitfalls to navigate (access control, SSR, enrollment, OG tags).
- **Inline feedback fifth** because it enhances existing functionality and benefits from decomposed components.
- **Visual polish last** because it is a sweep pass that should happen once all structural and functional changes are stable.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Role Simplification):** Needs a complete audit of all 25+ API routes that check `user.role`. The migration from role-based to ownership-based auth is well-understood in pattern but requires careful enumeration of every affected route.
- **Phase 4 (Public Catalog):** Needs research into the full access control chain and SSR patterns for the specific route structure. The catalog-to-lesson viewing chain must be mapped completely before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Dark Mode Fix):** Fully documented in Tailwind CSS 4 official docs. Exact CSS changes identified in research. No ambiguity.
- **Phase 3 (Component Decomposition):** Standard React refactoring. The components to extract are already identified.
- **Phase 5 (Inline Feedback Polish):** Existing pipeline works. Changes are additive (versioning array, rate limits, UI tweaks).
- **Phase 6 (Visual Polish):** Standard Tailwind CSS work. No architectural decisions needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All recommendations verified against official Tailwind CSS 4 and React 19 docs. Existing stack covers all needs. |
| Features | HIGH | Feature priorities derived from codebase analysis and PROJECT.md requirements. Clear dependency chains identified. |
| Architecture | HIGH | No structural changes needed. All patterns verified against existing codebase implementation. |
| Pitfalls | HIGH | All 15 pitfalls based on direct codebase inspection with specific file/line references. Dark mode fix verified against official docs. |

**Overall confidence:** HIGH

Research is unusually high-confidence because this is a brownfield project with an established codebase. All recommendations come from direct codebase analysis cross-referenced with official documentation. There is no speculation about technology choices or architectural patterns -- the stack is fixed and the work is scoped.

### Gaps to Address

- **Exact API route audit for role simplification**: Research identifies 25+ routes but does not enumerate every one. Phase 2 planning needs a complete list of routes to update, with specific line numbers and the ownership check to replace each role check.
- **Auth page dark mode coverage**: Research confirms auth layout (`app/(auth)/layout.tsx`) uses hardcoded light colors, but the exact set of classes to add needs to be determined during implementation by auditing the auth pages visually.
- **Public catalog query performance**: MongoDB text index is recommended, but the actual index definition and query patterns need validation against the Course schema during Phase 4 planning.
- **Content versioning schema design**: The `contentHistory` array concept is clear, but the exact Mongoose schema change and migration strategy for existing lessons need to be worked out in Phase 5 planning.

## Sources

### Primary (HIGH confidence)
- Tailwind CSS 4 dark mode docs: https://tailwindcss.com/docs/dark-mode -- `@custom-variant` syntax for class-based toggling
- Tailwind CSS 4 theme docs: https://tailwindcss.com/docs/theme -- `@theme` directive and CSS variable patterns
- Tailwind CSS v4 release blog: https://tailwindcss.com/blog/tailwindcss-v4 -- migration from v3 config to CSS-first
- Next.js App Router docs: https://nextjs.org/docs/app/building-your-application/styling/css -- CSS integration
- Direct codebase analysis: `globals.css`, `app/layout.tsx`, `app/(dashboard)/layout.tsx`, `app/(auth)/layout.tsx`, `lib/auth/middleware.ts`, `lib/auth/courseOwnership.ts`, 25+ API route files, `lib/ai/services/lessonContentGenerator.ts`, `components/ui/MarkdownContent.tsx`
- `.planning/PROJECT.md` and `.planning/codebase/CONCERNS.md` -- project requirements and known issues

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
