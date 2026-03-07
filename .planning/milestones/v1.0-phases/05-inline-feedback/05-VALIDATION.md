---
phase: 5
slug: inline-feedback
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 |
| **Config file** | `jest.config.ts` |
| **Quick run command** | `npm test -- --testPathPattern="lessonFeedback|lessonRevert|aiGeneration" -x` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="lessonFeedback|lessonRevert|aiGeneration" -x`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | FDBK-03 | integration | `npm test -- __tests__/integration/courses/lessonRevert.test.ts -x` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | FDBK-02 | integration | `npm test -- __tests__/integration/queue/aiGeneration.test.ts -x` | ✅ (extend) | ⬜ pending |
| 05-01-03 | 01 | 1 | FDBK-05 | integration | `npm test -- __tests__/integration/courses/lessonFeedback.test.ts -x` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | FDBK-01 | unit | `npm test -- __tests__/integration/courses/lessonFeedback.test.ts -x` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | FDBK-04 | unit | `npm test -- __tests__/integration/courses/lessonFeedback.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/integration/courses/lessonFeedback.test.ts` — stubs for FDBK-01, FDBK-04, FDBK-05 (generate route auth expansion, credits endpoint, feedback validation)
- [ ] `__tests__/integration/courses/lessonRevert.test.ts` — stubs for FDBK-03 (revert endpoint, previousContent preservation)
- [ ] Extend `__tests__/integration/queue/aiGeneration.test.ts` — add test case for feedback parameter saving previousContent

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skeleton loader appears during regeneration | FDBK-02 | Visual UI state | 1. Open AI lesson as owner 2. Submit feedback 3. Verify skeleton replaces content 4. Verify new content appears on completion |
| Undo toast appears for ~30 seconds with action button | FDBK-03 | Visual timing + interaction | 1. Regenerate lesson 2. Verify undo bar appears 3. Click Undo within 30s 4. Verify content reverts |
| Suggestion chips pre-fill textarea | FDBK-01 | UI interaction | 1. Click "Too advanced" chip 2. Verify textarea populates 3. Verify submit works without 10-char minimum |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
