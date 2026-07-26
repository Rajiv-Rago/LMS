# Full Security Audit Spec

## Goal

A complete security audit of the application after all other launch work (Phases 1–4) has landed, so the audit covers the final shipped surface — including payments — rather than a moving target. This is distinct from the hardening pass in SECURITY_HARDENING_SPEC.md, which fixes known gaps; this audit hunts for unknown ones.

## Prerequisites

- All other launch specs implemented: legal pages, email verification, abuse controls, hardening headers, ops enforcement, and payments.
- Runs against a production-like environment: `NODE_ENV=production`, S3 storage, real email provider, Stripe test mode.

## Scope

### Automated pass

- Full `/security-review` run on the complete codebase state (not just a branch diff) — this re-covers everything added since the Phase 3 hardening review, most importantly the billing routes.
- `npm audit --audit-level=high` with all findings resolved or pinned with a written justification.

### Manual review checklist

Focused on the custom logic where automated review is weakest:

- **Authorization**: every route under `app/api/courses/` verified against `lib/auth/courseOwnership.ts` semantics — owner vs instructor vs enrolled student vs stranger, for read, modify, and delete. Pay attention to nested resources (modules, lessons, assignments, submissions) inheriting the parent course check.
- **IDOR sweep**: any route taking an ID (`courseId`, `assignmentId`, `submissionId`, `sessionId`, report IDs) checked for access with another user's ID.
- **File handling**: path traversal attempts against `app/api/files/[...path]`, upload type/size bypass attempts, stored-XSS payloads (HTML, SVG, PDF) confirmed non-executing.
- **Auth flows**: session revocation actually invalidates, OAuth account-linking cannot take over an existing account, password reset and email verification tokens are single-use and expire, lockout cannot be bypassed via OAuth.
- **Billing**: webhook signature verification, replayed events are idempotent, forged success redirects grant nothing, checkout cannot be initiated for another user's account.
- **Rate limits**: register/forgot-password/report limits hold under concurrent requests; IP spoofing via forged proxy headers does not bypass them.
- **Injection**: Mongo query injection via unvalidated request fields (operators in strings), prompt-injection paths into AI generation that could exfiltrate other users' content.
- **Information disclosure**: error responses leak no stack traces in production; enumeration checked on login, register, forgot-password, resend-verification.

### Test-mode attack session

- One structured session actually attempting the checklist above against the production-like environment with two test accounts (attacker + victim) and an admin account. Findings recorded with severity in this doc's companion report.

## Deliverable

- `docs/launch/SECURITY_AUDIT_REPORT.md`: date, environment, findings with severity (critical/high/medium/low), and resolution status. Every critical/high fixed before public launch; mediums fixed or accepted with a written reason.

## Decisions

- External pentest: not at launch scale. Revisit when there is revenue or a security-sensitive customer segment. The Deliverable report doubles as the scoping document if one is commissioned later.

## Acceptance Checks

- Audit ran after all Phase 1–4 work merged, against a production-like environment.
- The report exists with every checklist area covered and dated.
- Zero unresolved critical or high findings at launch.
- `/security-review` and `npm audit` both clean or explicitly dispositioned.
