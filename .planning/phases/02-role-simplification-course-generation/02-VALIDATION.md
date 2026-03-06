---
phase: 2
slug: role-simplification-course-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 02-01-01 | 01 | 0 | ROLE-01, CGEN-01, CGEN-03 | integration | `npm test -- __tests__/integration/courses/generation.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | ROLE-05 | integration | `npm test -- __tests__/integration/courses/authorization.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 0 | ROLE-02 | integration | `npm test -- __tests__/integration/auth/register.test.ts -x` | ✅ (update) | ⬜ pending |
| 02-01-04 | 01 | 0 | ROLE-04 | integration | `npm test -- __tests__/integration/courses/crud.test.ts -x` | ✅ (update) | ⬜ pending |
| 02-XX-XX | XX | X | ROLE-03 | manual-only | Visual inspection | N/A | ⬜ pending |
| 02-XX-XX | XX | X | DASH-01 | manual-only | Visual inspection | N/A | ⬜ pending |
| 02-XX-XX | XX | X | DASH-02 | manual-only | User flow test | N/A | ⬜ pending |
| 02-XX-XX | XX | X | DASH-03 | integration | `npm test -- __tests__/integration/courses/dashboard.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-XX-XX | XX | X | CGEN-02 | unit | `npm test -- lib/ai/services/syllabusGenerator.test.ts -x` | ✅ (update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/integration/courses/generation.test.ts` — stubs for ROLE-01, CGEN-01, CGEN-03
- [ ] `__tests__/integration/courses/authorization.test.ts` — stubs for ROLE-05
- [ ] `__tests__/integration/courses/dashboard.test.ts` — stubs for DASH-03
- [ ] Update `__tests__/integration/auth/register.test.ts` — update for ROLE-02
- [ ] Update `__tests__/integration/courses/crud.test.ts` — update for ROLE-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No teacher UI elements in learner pages | ROLE-03 | Visual/CSS rendering | Navigate dashboard, courses page, assignments as student — confirm no "Create Course" teacher buttons, no teacher stats |
| Dashboard generation entry point | DASH-01 | UI layout verification | Log in as new user — confirm search-bar style input visible at top of dashboard |
| 2-click generation | DASH-02 | End-to-end user flow | Type topic + click Generate — confirm course starts generating |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
