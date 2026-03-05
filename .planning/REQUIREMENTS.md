# Requirements: Kantigo UX Polish

**Defined:** 2026-03-06
**Core Value:** Anyone can turn a topic into a structured, high-quality learning path in seconds --- and it gets better every time someone uses it.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Dark Mode

- [x] **DARK-01**: Dark/light mode toggle in sidebar visibly changes the app's color scheme
- [x] **DARK-02**: Dark mode applies consistently across all dashboard pages (courses, lessons, profile, settings)
- [x] **DARK-03**: Dark mode applies to auth pages (login, register, forgot password, reset password)
- [x] **DARK-04**: Markdown/prose content renders correctly in dark mode (inverted colors, readable code blocks)
- [x] **DARK-05**: Theme transitions are smooth (no jarring instant color swap)
- [x] **DARK-06**: System theme preference is respected on first visit, with manual override

### Role Simplification

- [ ] **ROLE-01**: Any authenticated user can generate courses (no teacher role required)
- [ ] **ROLE-02**: Registration page has no role selection --- all users are learners
- [ ] **ROLE-03**: Teacher-specific UI elements (labels, conditionals) are removed from student-facing pages
- [ ] **ROLE-04**: Admin retains ability to manually create and edit courses
- [ ] **ROLE-05**: API routes use ownership-based authorization instead of role-based checks

### Course Generation

- [ ] **CGEN-01**: Course generation produces hybrid courses mixing AI text lessons and YouTube video lessons
- [ ] **CGEN-02**: AI decides which lessons are text vs video based on topic and content availability
- [ ] **CGEN-03**: Single unified generation flow (no separate "AI course" vs "YouTube course")

### Dashboard & Navigation

- [ ] **DASH-01**: Dashboard has a prominent "Create Course" entry point for AI generation
- [ ] **DASH-02**: Course generation can be started in 2 clicks from the dashboard (topic input + generate)
- [ ] **DASH-03**: Dashboard shows user's enrolled courses and generated courses clearly

### Public Catalog

- [ ] **CATL-01**: Public course catalog page is browsable without authentication
- [ ] **CATL-02**: Catalog supports keyword search across course titles and descriptions
- [ ] **CATL-03**: User can enroll in a course from the catalog with one click (redirects to login if needed)
- [ ] **CATL-04**: Courses have shareable URLs with Open Graph metadata for link previews

### Inline Feedback

- [ ] **FDBK-01**: Learner can submit feedback on a lesson (text input describing the issue)
- [ ] **FDBK-02**: Submitting feedback triggers instant LLM regeneration of the lesson content
- [ ] **FDBK-03**: Previous lesson content is preserved (versioned) so bad regenerations can be reverted
- [ ] **FDBK-04**: Feedback UI is visible and discoverable (not hidden in a collapsed accordion)
- [ ] **FDBK-05**: Regeneration has rate limiting to prevent cost abuse

### Visual Polish

- [ ] **VISL-01**: Loading states use consistent skeleton screens across all pages
- [ ] **VISL-02**: Responsive design works on mobile --- no content overflow or broken layouts
- [ ] **VISL-03**: Consistent spacing and typography across dashboard pages

### Bug Fixes

- [ ] **BUGS-01**: Identify and fix broken functionality across core flows (auth, courses, lessons, quizzes, AI generation)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Feedback Enhancements

- **FDBK-06**: Section-level feedback --- learner can flag specific paragraphs for regeneration
- **FDBK-07**: Feedback history visible per lesson (what was changed and why)

### Discovery

- **CATL-05**: Course categories/tags for filtered browsing
- **CATL-06**: Popular/trending courses section
- **CATL-07**: Course rating system

### Visual

- **VISL-04**: Syntax highlighting in code blocks for programming courses
- **VISL-05**: Semantic CSS color tokens for maintainability

## Out of Scope

| Feature | Reason |
|---------|--------|
| Teacher role and manual course creation UI | Simplified to AI-only for learners; admin retains manual creation |
| Separate YouTube-only course generation | Courses are hybrid --- AI decides format per lesson; no separate YouTube flow |
| Component library migration (shadcn/ui, Radix) | Creates mid-project inconsistency; existing components work |
| Full theme customization (accent colors, fonts) | Users want to learn, not design |
| Real-time collaboration | Self-paced learning platform |
| Animated page transitions | Adds complexity, can feel sluggish |
| External search service (Algolia) | MongoDB text index sufficient at current scale |
| Mobile app | Web-first |
| Payment/subscription | Free for now |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DARK-01 | Phase 1: Dark Mode | Complete |
| DARK-02 | Phase 1: Dark Mode | Complete |
| DARK-03 | Phase 1: Dark Mode | Complete |
| DARK-04 | Phase 1: Dark Mode | Complete |
| DARK-05 | Phase 1: Dark Mode | Complete |
| DARK-06 | Phase 1: Dark Mode | Complete |
| ROLE-01 | Phase 2: Role Simplification & Course Generation | Pending |
| ROLE-02 | Phase 2: Role Simplification & Course Generation | Pending |
| ROLE-03 | Phase 2: Role Simplification & Course Generation | Pending |
| ROLE-04 | Phase 2: Role Simplification & Course Generation | Pending |
| ROLE-05 | Phase 2: Role Simplification & Course Generation | Pending |
| CGEN-01 | Phase 2: Role Simplification & Course Generation | Pending |
| CGEN-02 | Phase 2: Role Simplification & Course Generation | Pending |
| CGEN-03 | Phase 2: Role Simplification & Course Generation | Pending |
| DASH-01 | Phase 2: Role Simplification & Course Generation | Pending |
| DASH-02 | Phase 2: Role Simplification & Course Generation | Pending |
| DASH-03 | Phase 2: Role Simplification & Course Generation | Pending |
| BUGS-01 | Phase 3: Stabilization & Bug Fixes | Pending |
| CATL-01 | Phase 4: Public Catalog & Sharing | Pending |
| CATL-02 | Phase 4: Public Catalog & Sharing | Pending |
| CATL-03 | Phase 4: Public Catalog & Sharing | Pending |
| CATL-04 | Phase 4: Public Catalog & Sharing | Pending |
| FDBK-01 | Phase 5: Inline Feedback | Pending |
| FDBK-02 | Phase 5: Inline Feedback | Pending |
| FDBK-03 | Phase 5: Inline Feedback | Pending |
| FDBK-04 | Phase 5: Inline Feedback | Pending |
| FDBK-05 | Phase 5: Inline Feedback | Pending |
| VISL-01 | Phase 6: Visual Polish | Pending |
| VISL-02 | Phase 6: Visual Polish | Pending |
| VISL-03 | Phase 6: Visual Polish | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after roadmap creation*
