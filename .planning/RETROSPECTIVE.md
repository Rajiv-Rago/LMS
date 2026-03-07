# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — UX Polish

**Shipped:** 2026-03-07
**Phases:** 6 | **Plans:** 21

### What Was Built
- Three-way theme toggle (dark/light/system) with Tailwind CSS 4 class-based dark mode
- Learner-only role model with ownership-based authorization and unified AI+YouTube course generation
- Stabilized core flows: Enrollment collection migration, split quiz routes, centralized getCoursePermissions
- Public catalog with three-tier access control, search, OG metadata, and post-auth auto-enrollment
- Inline lesson feedback with LLM regeneration, content versioning, revert, and AI credit tracking
- Skeleton loading states, Button/EmptyState/BottomNav component library, consistent typography and spacing

### What Worked
- Yolo mode with parallel execution kept velocity high — 21 plans in 2 days
- Phase ordering was well-sequenced: dark mode first (unblocked visual verification), stabilization before public catalog (fixed bugs before exposing to unauthenticated users)
- Ownership-based authorization (getCoursePermissions) created a clean, reusable pattern that simplified all subsequent phases
- Research phase before planning caught key complexity (25+ teacher-gated routes, monolithic components) early

### What Was Inefficient
- ROADMAP.md plan checkboxes drifted from disk state (phases 3-5 show unchecked plans despite having summaries) — the source of truth should be disk, not markdown checkboxes
- STATE.md performance metrics grew verbose with per-plan rows that duplicated the phase summary table
- Some blockers/concerns in STATE.md were resolved during execution but never cleaned up

### Patterns Established
- `getCoursePermissions` as single authorization entry point for all course-related routes
- `Enrollment` collection as source of truth (replacing `Course.enrolledStudents` array)
- Three-tier access control (`restricted`/`unlisted`/`published`) with `isPublished` virtual for backward compat
- Skeleton loading pattern: `loading.tsx` files with shared skeleton components per route group
- Button/EmptyState as reusable UI primitives with consistent styling
- Content versioning via `previousContent` field for single-level undo

### Key Lessons
1. Centralizing authorization early (Phase 3) paid dividends in every subsequent phase — do authorization patterns first
2. Atomic enrollment via unique index + duplicate key catch is more reliable than check-then-create
3. Tailwind CSS 4's `@custom-variant` with `&:where(.dark, .dark *)` is the clean pattern for class-based dark mode
4. Post-auth redirects (auto-enrollment) need Suspense boundaries around `useSearchParams` for SSR safety

### Cost Observations
- Model mix: Primarily Opus for planning/execution
- Sessions: ~10 sessions across 2 days
- Notable: Average plan execution was 6-7 minutes — the research + plan-check workflow kept plans tight

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 6 | 21 | First milestone — established GSD workflow patterns |

### Top Lessons (Verified Across Milestones)

1. (Awaiting verification from future milestones)
