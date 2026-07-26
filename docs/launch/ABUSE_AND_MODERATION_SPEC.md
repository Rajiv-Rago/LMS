# Abuse Controls & Content Moderation Spec

## Goal

Close the abuse paths that open up the moment registration is public: unthrottled account creation, email bombing via forgot-password, and unmoderated user content on `/explore`.

## Current State

- Login has failed-attempt lockout with audit events. AI routes are rate-limited per user tier (`lib/ai/rateLimit.ts`).
- Register and forgot-password have **no per-IP throttling** — open to mass account creation and using the reset flow to spam arbitrary inboxes.
- Any user can publish a course visible on public `/explore` and `/courses/[id]` pages. There is no report mechanism and no admin path to unpublish content (admin trash exists but nothing feeds it from moderation).

## Target State

- Register, forgot-password, and verification-resend endpoints are rate-limited per IP.
- Public course pages have a "Report" action; reports notify the admin by email and are listed for admin review.
- Admins can unpublish any course (remove from `/explore` without deleting the owner's data).

## Scope

### Per-IP rate limiting

- A small fixed-window limiter keyed on `(ip, route)`, stored in Mongo with a TTL index — same infrastructure pattern as the existing AI rate limiter; no Redis requirement (`REDIS_URL` stays optional).
- Limits (tune later): register 5/hour/IP, forgot-password 5/hour/IP, verify-resend 3/hour/user.
- On limit: 429 with a generic message. Never reveal whether an email exists.
- IP source: trusted proxy header handling must match the production deployment (see OPERATIONS_SPEC.md); a spoofable `X-Forwarded-For` makes the limiter decorative.

### Content reporting

- `Report` model: `courseId`, `reporterId` (nullable for logged-out reporters — decide below), `reason` enum (spam, copyright, inappropriate, other), free-text detail, `status` (open/resolved), timestamps.
- `POST /api/courses/[id]/report` — rate-limited (e.g. 5/day/user), creates the report and emails the admin address via `lib/email`.
- Report button on the public course page and lesson view. Minimal UI: modal with reason + optional text.

### Admin moderation

- `GET /api/admin/reports` + a simple admin page listing open reports with the reported course inline.
- Unpublish action: sets a `published: false` (or equivalent visibility flag) on the course — hidden from `/explore` and public pages, still visible to its owner with a "removed by moderation" notice. Deletion stays a separate, existing flow (admin trash).
- Resolve/dismiss actions on reports, recorded in the existing audit-event stream.

### AI-content abuse

- Existing per-user AI rate limiting plus email verification (EMAIL_VERIFICATION_SPEC.md) are the primary controls. No LLM-based output moderation at launch — revisit if reports show AI-generated abuse in practice.

## Decisions

- Logged-out reporting: recommend requiring login at launch — it kills report spam and every visitor who cares enough to report can register.

## Out of Scope

- Automated content scanning/classification.
- User-to-user blocking or comment moderation (no comments feature exists).
- CAPTCHA — add only if IP limiting proves insufficient after launch.

## Acceptance Checks

- 6th registration attempt from one IP within an hour gets 429; a different IP is unaffected.
- Forgot-password for the same address cannot be triggered more than the limit per IP per hour.
- A logged-in user can report a public course; the admin receives an email and sees it in the reports list.
- Admin unpublish removes the course from `/explore` and public URLs immediately; the owner still sees it with a moderation notice.
- All moderation actions appear in audit events.
