# Launch Readiness Roadmap

## Goal

Take Kantigo from "feature-complete for friendly users" to publicly launchable. This roadmap covers what is missing, not what already works. Each area has its own spec in `docs/launch/`.

Ordering follows dependency and risk: legal pages block any public launch, email verification protects AI spend the moment strangers can register, and payments come last because a free-tier-only soft launch is viable once everything else is done.

## Current State (What Already Exists)

- Auth.js sessions with revocation, account lockout, audit events, password reset.
- GDPR-shaped data controls: `/api/users/me/export` and `/api/users/me/delete`.
- Pluggable email (console/SendGrid/SES/Resend) and storage (local/S3).
- AI rate limiting by `subscriptionTier` (`free | plus | admin`) with a credits API.
- Axiom logging, `/api/health`, robots.txt, sitemap, landing page.

## What Is Missing

| # | Area | Spec | Blocks launch? |
|---|------|------|----------------|
| 1 | Legal pages (Terms, Privacy, DMCA, contact) | [LEGAL_PAGES_SPEC.md](launch/LEGAL_PAGES_SPEC.md) | Yes |
| 2 | Email verification | [EMAIL_VERIFICATION_SPEC.md](launch/EMAIL_VERIFICATION_SPEC.md) | Yes — protects AI spend |
| 3 | Abuse controls & content moderation | [ABUSE_AND_MODERATION_SPEC.md](launch/ABUSE_AND_MODERATION_SPEC.md) | Yes — register/forgot throttling at minimum |
| 4 | Security hardening (headers, file serving) | [SECURITY_HARDENING_SPEC.md](launch/SECURITY_HARDENING_SPEC.md) | Yes — cheap, do before exposure |
| 5 | Operations (prod config, backups, uptime) | [OPERATIONS_SPEC.md](launch/OPERATIONS_SPEC.md) | Yes — mostly configuration |
| 6 | Payments & subscriptions (Stripe) | [PAYMENTS_SPEC.md](launch/PAYMENTS_SPEC.md) | No — free-tier soft launch works without it |
| 7 | Full security audit | [SECURITY_AUDIT_SPEC.md](launch/SECURITY_AUDIT_SPEC.md) | Yes — final gate before public launch |

## Phases

### Phase 1: Legal Foundation

Terms of Service, Privacy Policy, DMCA/contact page, footer links, ToS consent checkbox on registration, minimum-age statement. No launch of any kind without this.

### Phase 2: Abuse Protection

Email verification gating AI generation; per-IP rate limiting on register and forgot-password; report-content endpoint and admin unpublish. These three close the "stranger with a script" attack surface: fake accounts draining LLM credits, email bombing, and junk on `/explore`.

### Phase 3: Hardening & Ops

Security headers in `next.config.ts`, safe file-serving defaults, production env enforcement (S3 + real email provider required in prod), Mongo backup verification, external uptime monitor on `/api/health`. Run `/security-review` at the end of this phase.

**Soft launch is possible after Phase 3** — free tier only, invite or open registration.

### Phase 4: Payments

Stripe Checkout + webhook flipping `subscriptionTier`, pricing page, hosted billing portal, refund policy added to Terms. Ships independently once Phases 1–3 are live.

### Phase 5: Full Security Audit

After everything else has landed: full-codebase `/security-review`, a manual checklist review of authorization, file handling, auth flows, billing, and rate limits, plus a structured attack session against a production-like environment. Produces `SECURITY_AUDIT_REPORT.md`; zero unresolved critical/high findings is the final launch gate.

## Acceptance Check (Roadmap-Level)

A stranger can register, verify their email, generate a course, publish it, and pay for plus — while a hostile stranger cannot drain AI credits, bomb inboxes, XSS other users via uploads, or keep abusive content on `/explore` after a report.
