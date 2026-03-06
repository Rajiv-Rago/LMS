---
phase: 3
slug: stabilization-bug-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.2.0 |
| **Config file** | `jest.config.ts` |
| **Quick run command** | `npm test -- --testPathPattern="<pattern>" --forceExit` |
| **Full suite command** | `npm test -- --forceExit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="<affected-area>" --forceExit`
- **After every plan wave:** Run `npm test -- --forceExit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | BUGS-01 (objectid) | integration | `npm test -- --testPathPattern="objectid\|validation" --forceExit` | Wave 0 | pending |
| 03-01-02 | 01 | 1 | BUGS-01 (permissions) | unit | `npm test -- --testPathPattern="coursePermissions" --forceExit` | Wave 0 | pending |
| 03-02-01 | 02 | 2 | BUGS-01 (auth) | integration | `npm test -- --testPathPattern="auth" --forceExit` | Partial | pending |
| 03-03-01 | 03 | 2 | BUGS-01 (enrollment) | integration | `npm test -- --testPathPattern="enrollment" --forceExit` | Needs rewrite | pending |
| 03-04-01 | 04 | 3 | BUGS-01 (quiz) | integration | `npm test -- --testPathPattern="quiz" --forceExit` | Wave 0 | pending |
| 03-05-01 | 05 | 3 | BUGS-01 (generation) | integration | `npm test -- --testPathPattern="generation" --forceExit` | Partial | pending |
| 03-06-01 | 06 | 4 | BUGS-01 (queue) | integration | `npm test -- --testPathPattern="queue\|worker" --forceExit` | Wave 0 | pending |
| 03-07-01 | 07 | 4 | BUGS-01 (soft-delete) | integration | `npm test -- --testPathPattern="soft-delete\|User" --forceExit` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/integration/quiz/` directory and quiz flow test stubs — covers BUGS-01 (quiz)
- [ ] `__tests__/integration/queue/worker.test.ts` — covers BUGS-01 (queue)
- [ ] `lib/utils/validateObjectId.test.ts` — covers BUGS-01 (objectid)
- [ ] `lib/auth/coursePermissions.test.ts` — covers BUGS-01 (permissions)
- [ ] `lib/models/Enrollment.test.ts` — covers BUGS-01 (enrollment)
- [ ] Test fixtures: `createTestEnrollment()` and `createTestQuizAssignment()` helpers

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session persistence across browser restart | BUGS-01 (auth) | Requires real browser + cookie persistence | 1. Login 2. Close browser 3. Reopen 4. Visit /dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
