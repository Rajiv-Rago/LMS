---
phase: 6
slug: visual-polish
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-07
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 with next/jest |
| **Config file** | `jest.config.ts` |
| **Quick run command** | `npm test -- --testPathPattern="PATTERN" --forceExit` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Visual inspection of affected pages at mobile (375px) and desktop (1440px) widths
- **After every plan wave:** Full navigation walkthrough at 375px and 1440px widths
- **Before `/gsd:verify-work`:** Complete page-by-page audit at mobile (375px), tablet (768px), and desktop (1440px)
- **Max feedback latency:** Manual visual inspection per task

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | VISL-01 | manual | Visual: verify skeleton on page load | N/A | pending |
| TBD | 01 | 1 | VISL-02 | manual | Visual: verify mobile layout at 375px | N/A | pending |
| TBD | 01 | 1 | VISL-03 | manual | Visual: verify typography/spacing scale | N/A | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. All three requirements (VISL-01, VISL-02, VISL-03) are visual/layout requirements verified by manual inspection. The project uses `jest-environment-node` (no DOM/browser) and has no component testing or visual regression testing tools. Adding visual regression testing is out of scope for this phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skeleton screens on all loading pages | VISL-01 | Visual/layout requirement — no DOM testing in Jest (node environment) | Navigate to each page, verify skeleton appears during load, no spinning circles |
| Mobile responsive — no overflow/broken layouts | VISL-02 | Visual/layout requirement — requires browser viewport testing | Test each dashboard page at 375px, 640px, 768px, 1024px — no horizontal scroll, no content overflow |
| Consistent spacing and typography | VISL-03 | Visual/layout requirement — typography consistency is visual | Compare page titles, section headings, card titles, body text, captions across all pages — verify scale consistency |

---

## Validation Sign-Off

- [x] All tasks have manual verify instructions (no automated tests possible for visual requirements)
- [x] Sampling continuity: every task has visual inspection verification
- [x] Wave 0 covers all MISSING references (none needed — manual-only phase)
- [x] No watch-mode flags
- [x] Feedback latency: manual inspection per task commit
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
