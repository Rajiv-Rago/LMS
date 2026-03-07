---
phase: 2
slug: role-simplification-course-generation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 |
| **Config file** | `jest.config.ts` |
| **Quick run command** | `npm test -- --testPathPattern="path" --no-coverage` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="relevant-file" --no-coverage`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | ROLE-01, ROLE-02 | integration | `npm test -- __tests__/integration/auth/register.test.ts __tests__/integration/courses/crud.test.ts -x` | ✅ (update) | ⬜ pending |
| 02-01-02 | 01 | 1 | ROLE-04, ROLE-05 | integration | `npm test -- __tests__/integration/courses/authorization.test.ts __tests__/integration/auth/register.test.ts __tests__/integration/courses/crud.test.ts -x` | ❌ W0 (authorization.test.ts created in task) | ⬜ pending |
| 02-02-01 | 02 | 2 | CGEN-01, CGEN-02, CGEN-03 | integration | `npm test -- __tests__/integration/courses/generation.test.ts -x` | ❌ W0 (created in task, TDD) | ⬜ pending |
| 02-03-01 | 03 | 3 | DASH-03 | integration | `npm test -- __tests__/integration/courses/dashboard.test.ts -x` | ❌ W0 (created in task) | ⬜ pending |
| 02-03-02 | 03 | 3 | DASH-01, DASH-02, DASH-03 | integration + lint | `npm test -- __tests__/integration/courses/dashboard.test.ts --no-coverage -x && npm run lint` | ✅ (after Task 1) | ⬜ pending |
| 02-03-03 | 03 | 3 | ROLE-03, ROLE-04 | lint | `npm run lint` | N/A | ⬜ pending |
| 02-03-04 | 03 | 3 | ROLE-03, DASH-01, DASH-02 | manual | Visual inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `__tests__/integration/courses/generation.test.ts` — created in 02-02-01 (TDD, RED phase creates test first)
- [x] `__tests__/integration/courses/authorization.test.ts` — created in 02-01-02
- [x] `__tests__/integration/courses/dashboard.test.ts` — created in 02-03-01
- [x] Update `__tests__/integration/auth/register.test.ts` — updated in 02-01-02
- [x] Update `__tests__/integration/courses/crud.test.ts` — updated in 02-01-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No teacher UI elements in learner pages | ROLE-03 | Visual/CSS rendering | Navigate dashboard, courses page, assignments as student — confirm no "Create Course" teacher buttons, no teacher stats |
| Dashboard generation entry point | DASH-01 | UI layout verification | Log in as new user — confirm search-bar style input visible at top of dashboard |
| 2-click generation | DASH-02 | End-to-end user flow | Type topic + click Generate — confirm course starts generating |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
