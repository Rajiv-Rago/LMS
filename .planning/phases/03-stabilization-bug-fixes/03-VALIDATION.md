---
phase: 3
slug: stabilization-bug-fixes
status: draft
nyquist_compliant: true
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
| 03-01-01 | 01 | 1 | BUGS-01 (utilities) | integration | `npm test -- --testPathPattern="validateObjectId\|coursePermissions\|Enrollment" --forceExit` | Wave 0 | pending |
| 03-01-02 | 01 | 1 | BUGS-01 (fixtures) | integration | `npm test -- --testPathPattern="Enrollment\|coursePermissions" --forceExit` | Wave 0 | pending |
| 03-02-01 | 02 | 2 | BUGS-01 (enrollment route) | integration | `npm test -- --testPathPattern="enrollment" --forceExit` | Needs rewrite | pending |
| 03-02-02 | 02 | 2 | BUGS-01 (enrollment migration) | integration | `npm test -- --forceExit` | Existing | pending |
| 03-03-01 | 03 | 2 | BUGS-01 (quiz split) | integration | `npm test -- --testPathPattern="quiz" --forceExit` | Wave 0 | pending |
| 03-03-02 | 03 | 2 | BUGS-01 (quiz frontend) | build | `npm run build 2>&1 \| tail -20` | Existing | pending |
| 03-04-01 | 04 | 3 | BUGS-01 (auth tests) | integration | `npm test -- --testPathPattern="authorization" --forceExit` | Wave 0 | pending |
| 03-04-02 | 04 | 3 | BUGS-01 (auth consolidation) | integration | `npm test -- --forceExit` | Existing | pending |
| 03-05-01 | 05 | 3 | BUGS-01 (soft-delete, auth, deletion) | integration | `npm test -- --testPathPattern="User.test\|session\|deletion" --forceExit` | Wave 0 | pending |
| 03-05-02 | 05 | 3 | BUGS-01 (queue worker) | integration | `npm test -- --testPathPattern="queue.*worker\|worker" --forceExit` | Wave 0 | pending |
| 03-06-01 | 06 | 3 | BUGS-01 (AI generation syllabus) | integration | `npm test -- --testPathPattern="aiGeneration" --forceExit` | Wave 0 | pending |
| 03-06-02 | 06 | 3 | BUGS-01 (AI generation module/lesson) | integration | `npm test -- --testPathPattern="aiGeneration" --forceExit` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `lib/utils/validateObjectId.test.ts` — covers BUGS-01 (objectid validation)
- [ ] `lib/auth/coursePermissions.test.ts` — covers BUGS-01 (permissions)
- [ ] `lib/models/Enrollment.test.ts` — covers BUGS-01 (enrollment model)
- [ ] `__tests__/integration/courses/enrollment.test.ts` — covers BUGS-01 (enrollment route)
- [ ] `__tests__/integration/quiz/` directory and quiz flow test stubs — covers BUGS-01 (quiz)
- [ ] `__tests__/integration/courses/authorization.test.ts` — covers BUGS-01 (auth consistency)
- [ ] `lib/models/User.test.ts` soft-delete tests — covers BUGS-01 (soft-delete)
- [ ] `__tests__/integration/auth/session.test.ts` — covers BUGS-01 (auth session)
- [ ] `__tests__/integration/account/deletion.test.ts` — covers BUGS-01 (account deletion)
- [ ] `__tests__/integration/queue/worker.test.ts` — covers BUGS-01 (queue worker)
- [ ] `__tests__/integration/queue/aiGeneration.test.ts` — covers BUGS-01 (AI generation handlers)
- [ ] Test fixtures: `createTestEnrollment()` and `createTestQuizAssignment()` helpers

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session persistence across browser restart | BUGS-01 (auth) | Requires real browser + cookie persistence | 1. Login 2. Close browser 3. Reopen 4. Visit /dashboard |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
