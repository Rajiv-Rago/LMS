# Email Verification Spec

## Goal

Verify email addresses at registration and gate AI generation on verification, so scripted signups cannot drain LLM API credits with throwaway addresses.

## Current State

- `User` has no `emailVerified` field; registration never sends an email.
- Free-tier users get AI credits immediately on signup — the direct cost exposure this spec closes.
- Email infrastructure already exists (`lib/email/` with console/SendGrid/SES/Resend providers and templates).
- A token-based flow pattern already exists in forgot-password/reset-password — reuse it.

## Target State

- New credentials-based registrations receive a verification email with a signed, expiring link.
- OAuth signups from trusted providers (Google, GitHub) are treated as verified automatically — the provider already verified the address.
- Unverified users can log in and browse, but AI generation routes (and course publishing) return 403 with a "verify your email" message.
- Users can resend the verification email from a banner shown while unverified.

## Scope

### Model

- `User.emailVerifiedAt: Date | null`. OAuth-created users get it set at creation. Existing users are backfilled as verified in a migration (`scripts/migrations/`) — they predate the requirement and locking them out would be a regression.

### Token flow

- Reuse the forgot-password token approach: hashed single-use token with expiry (24h), stored on the user or in the same token collection the reset flow uses.
- `GET /api/auth/verify-email?token=...` — validates, sets `emailVerifiedAt`, redirects to the dashboard with a success notice.
- `POST /api/auth/verify-email/resend` — authenticated, rate-limited (per-user, e.g. 3/hour), silently succeeds to avoid enumeration.

### Email

- New template in `lib/email/templates.ts` matching the existing reset-password template style (indigo `#4f46e5` branding).
- Sent from the register route after user creation, via the existing `lib/email` provider abstraction.

### Gating

- Extend the auth helper or add one check used by all AI generation routes (`app/api/ai/*`, `app/api/courses/*/generate*`, `app/api/courses/youtube/generate`): unverified → 403 `{ error: "Email verification required" }`.
- Also gate publishing a course to `/explore`.
- Do not gate: login, browsing, enrolling in public courses, or account settings — verification friction stays proportional to cost.

### UI

- Persistent dismissible banner in the dashboard shell for unverified users with a resend button.
- Verification landing state on the dashboard (success/expired/invalid).

## Decisions

- Whether quiz/assignment submission requires verification: recommend no — it costs nothing and blocking it hurts real students.

## Acceptance Checks

- Fresh credentials signup receives an email; the link verifies exactly once and expires after 24h.
- Unverified user hitting any AI generation route gets 403; verified user succeeds.
- OAuth signup via Google lands verified with no email sent.
- Resend is rate-limited and does not reveal whether an email exists.
- Migration marks all pre-existing users verified.
