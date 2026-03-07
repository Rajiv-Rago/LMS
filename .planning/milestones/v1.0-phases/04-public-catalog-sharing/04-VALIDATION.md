---
phase: 4
slug: public-catalog-sharing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.2.0 |
| **Config file** | `jest.config.ts` |
| **Quick run command** | `npm test -- --testPathPattern="catalog"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="catalog|enrollment"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CATL-01 | integration | `npm test -- __tests__/integration/courses/catalog.test.ts -t "unauthenticated"` | Wave 0 | pending |
| 04-01-02 | 01 | 1 | CATL-01 | integration | `npm test -- __tests__/integration/courses/catalog.test.ts -t "excludes"` | Wave 0 | pending |
| 04-01-03 | 01 | 1 | CATL-02 | integration | `npm test -- __tests__/integration/courses/catalog.test.ts -t "search"` | Wave 0 | pending |
| 04-02-01 | 02 | 1 | CATL-03 | integration | `npm test -- __tests__/integration/courses/catalog.test.ts -t "auto-enroll"` | Wave 0 | pending |
| 04-02-02 | 02 | 1 | CATL-03 | integration | `npm test -- __tests__/integration/courses/enrollment.test.ts -t "accessLevel"` | Wave 0 | pending |
| 04-03-01 | 03 | 2 | CATL-04 | unit | `npm test -- __tests__/integration/courses/catalog.test.ts -t "metadata"` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/integration/courses/catalog.test.ts` — stubs for CATL-01, CATL-02, CATL-03, CATL-04
- [ ] Update `__tests__/helpers/fixtures.ts` — add `accessLevel` support to `createTestCourse`

*Existing infrastructure covers test framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OG image renders correctly with indigo gradient and course title | CATL-04 | Visual rendering verification | 1. Navigate to `/courses/[id]` 2. Check page source for og:image tag 3. Use https://www.opengraph.xyz/ to preview |
| Social media link preview shows correct title, description, image | CATL-04 | Requires external social platform parsing | 1. Share course URL in Slack/Discord/Twitter 2. Verify rich preview shows course title, description, branded image |
| Responsive card grid (3/2/1 columns) | CATL-01 | Visual/responsive layout | 1. Open `/explore` at desktop, tablet, mobile widths 2. Verify 3/2/1 column layout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
