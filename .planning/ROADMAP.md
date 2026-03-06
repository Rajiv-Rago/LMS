# Roadmap: Kantigo UX Polish

## Overview

This milestone transforms Kantigo from a functional but rough prototype into a polished self-serve learning platform. The journey starts with fixing the broken dark mode (unblocking all visual verification), then simplifying the role model so any user can generate courses from the dashboard, then stabilizing existing functionality through a bug audit, then opening the platform to unauthenticated users with a public catalog and shareable links, then building the core differentiator (inline feedback with LLM regeneration), and finishing with a visual polish sweep across the entire app.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Dark Mode** - Fix broken dark/light toggle and ensure consistent theming across all pages
- [ ] **Phase 2: Role Simplification & Course Generation** - Any authenticated user can generate hybrid courses from the dashboard
- [ ] **Phase 3: Stabilization & Bug Fixes** - Audit and fix broken functionality across core flows
- [ ] **Phase 4: Public Catalog & Sharing** - Browsable course catalog and shareable enrollment links for unauthenticated users
- [ ] **Phase 5: Inline Feedback** - Learners can flag lesson issues and trigger instant LLM regeneration with content versioning
- [ ] **Phase 6: Visual Polish** - Consistent loading states, responsive design, and spacing across all pages

## Phase Details

### Phase 1: Dark Mode
**Goal**: Users can switch between dark and light mode and the entire app renders correctly in both themes
**Depends on**: Nothing (first phase)
**Requirements**: DARK-01, DARK-02, DARK-03, DARK-04, DARK-05, DARK-06
**Success Criteria** (what must be TRUE):
  1. Clicking the sidebar toggle switches the entire app between dark and light color schemes
  2. Every dashboard page (courses, lessons, profile, settings) renders correctly in dark mode with no unreadable text or invisible elements
  3. Auth pages (login, register, forgot password, reset password) render correctly in dark mode
  4. Markdown lesson content and code blocks are readable in dark mode
  5. A first-time visitor sees the app in their OS-preferred theme, and can override it manually
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Fix CSS dark mode, create three-way useTheme hook and ThemeToggle component
- [x] 01-02-PLAN.md — Wire ThemeToggle into dashboard and auth layouts, visual verification

### Phase 2: Role Simplification & Course Generation
**Goal**: Any authenticated user can generate a hybrid AI+YouTube course from the dashboard without needing a teacher role
**Depends on**: Phase 1
**Requirements**: ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05, CGEN-01, CGEN-02, CGEN-03, DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. A newly registered user (no role selection during signup) can generate a course from the dashboard in two clicks (topic input + generate)
  2. Generated courses contain a mix of AI text lessons and YouTube video lessons, decided by the AI based on topic
  3. The dashboard clearly shows the user's enrolled courses and their generated courses
  4. Admin can still manually create and edit courses
  5. No teacher-specific labels, dropdowns, or conditionals appear anywhere in the learner-facing UI
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Remove teacher role gates from registration and API routes, replace with ownership-based authorization
- [ ] 02-02-PLAN.md — Create unified course generation endpoint (POST /api/courses/generate) with 5-course limit
- [ ] 02-03-PLAN.md — Rebuild dashboard with inline generation input, two-section layout, and remove teacher UI conditionals

### Phase 3: Stabilization & Bug Fixes
**Goal**: Core platform flows work reliably with no broken functionality
**Depends on**: Phase 2
**Requirements**: BUGS-01
**Success Criteria** (what must be TRUE):
  1. Auth flow (register, login, logout, session persistence) works without errors
  2. Course generation, enrollment, and lesson progression complete successfully end-to-end
  3. Quiz taking (start, answer, submit, view results) works for all question types
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Public Catalog & Sharing
**Goal**: Anyone on the internet can discover courses, preview them, and enroll via a shareable link
**Depends on**: Phase 2, Phase 3
**Requirements**: CATL-01, CATL-02, CATL-03, CATL-04
**Success Criteria** (what must be TRUE):
  1. An unauthenticated user can browse the course catalog and search by keyword without logging in
  2. Clicking "Enroll" on a course redirects to login/register, then completes enrollment automatically after auth
  3. Sharing a course URL on social media or messaging shows a rich link preview with title, description, and image (Open Graph metadata)
  4. Enrolled users can navigate the full course content (modules, lessons) from the catalog entry point
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Inline Feedback
**Goal**: Learners can improve course content by flagging issues and triggering instant AI regeneration, with safety nets against bad outputs
**Depends on**: Phase 3
**Requirements**: FDBK-01, FDBK-02, FDBK-03, FDBK-04, FDBK-05
**Success Criteria** (what must be TRUE):
  1. A visible feedback form on each lesson lets the learner describe what is wrong and submit it
  2. Submitting feedback triggers LLM regeneration and the lesson content updates without a full page reload
  3. If a regeneration produces worse content, the learner can revert to a previous version
  4. A learner cannot trigger more regenerations than the rate limit allows (clear messaging when limit is hit)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Visual Polish
**Goal**: The app feels consistent and professional across all screen sizes with polished loading states
**Depends on**: Phase 1, Phase 5
**Requirements**: VISL-01, VISL-02, VISL-03
**Success Criteria** (what must be TRUE):
  1. Every page that loads data shows a skeleton loading screen (no blank pages or mismatched spinners)
  2. All dashboard pages render correctly on mobile with no content overflow, horizontal scrolling, or broken layouts
  3. Spacing, font sizes, and visual weight are consistent across dashboard pages (no jarring transitions between pages)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Dark Mode | 2/2 | Complete | 2026-03-05 |
| 2. Role Simplification & Course Generation | 0/3 | Not started | - |
| 3. Stabilization & Bug Fixes | 0/1 | Not started | - |
| 4. Public Catalog & Sharing | 0/2 | Not started | - |
| 5. Inline Feedback | 0/2 | Not started | - |
| 6. Visual Polish | 0/1 | Not started | - |
