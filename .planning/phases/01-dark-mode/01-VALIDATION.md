---
phase: 1
slug: dark-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 |
| **Config file** | `jest.config.ts` |
| **Quick run command** | `npm test -- --testPathPattern="useTheme" --forceExit` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test` + manual visual check of all pages in both themes
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | DARK-01, DARK-02 | manual-only | N/A (CSS fix, visual) | N/A | pending |
| 01-01-02 | 01 | 1 | DARK-05 | manual-only | N/A (transition timing) | N/A | pending |
| 01-01-03 | 01 | 1 | DARK-06 | unit | `npm test -- --testPathPattern="useTheme" --forceExit` | No -- W0 | pending |
| 01-02-01 | 02 | 1 | DARK-03 | manual-only | N/A (visual, auth pages) | N/A | pending |
| 01-02-02 | 02 | 1 | DARK-04 | manual-only | N/A (markdown rendering) | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/hooks/useTheme.test.ts` — stubs for DARK-06 (three-way state logic, localStorage persistence, cycling behavior)
- [ ] Manual verification checklist — covers DARK-01 through DARK-05 (list of pages to visually verify in both themes)

*Existing test infrastructure (Jest 30, jest.config.ts) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toggle changes color scheme | DARK-01 | Requires browser with CSS rendering | Click sidebar toggle, verify all backgrounds/text/borders change |
| All dashboard pages dark mode | DARK-02 | Visual verification across 18+ pages | Navigate each dashboard page in dark mode, check for unreadable text |
| Auth pages dark mode | DARK-03 | Visual verification across 4 pages | Check login, register, forgot-password, reset-password in dark mode |
| Markdown/code readable | DARK-04 | Requires CSS prose-invert rendering | Open a lesson with markdown content in dark mode |
| Smooth transitions | DARK-05 | Requires timing/visual verification | Toggle theme, verify 200ms smooth transition; reload, verify no flash |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
