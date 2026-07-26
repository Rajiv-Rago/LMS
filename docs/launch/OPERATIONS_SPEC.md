# Operations Spec

## Goal

Make production configuration explicit and fail-fast, confirm the backup story, and put an external monitor on the health endpoint. Almost entirely configuration and small env-validation changes.

## Current State

- `lib/env.ts` validates env vars but defaults `STORAGE_PROVIDER=local` and `EMAIL_PROVIDER=console` — silent misconfiguration in production loses uploads on redeploy and drops all outbound email.
- `/api/health` exists but nothing watches it.
- Axiom logging with `captureException` is wired throughout.
- No backup story is recorded anywhere in the repo.
- No support/abuse contact mailbox exists (legal pages need one — see LEGAL_PAGES_SPEC.md).

## Target State

- Production boot fails loudly if storage, email, or app URL are left on dev defaults.
- Mongo backups confirmed and restore tested once.
- External uptime monitoring with alerting on `/api/health`.
- A monitored support mailbox exists and is the address published on the legal pages.

## Scope

### Env enforcement (`lib/env.ts`)

- When `NODE_ENV=production`, refuse to start if:
  - `STORAGE_PROVIDER` is `local` (uploads must go to S3),
  - `EMAIL_PROVIDER` is `console`,
  - `EMAIL_FROM_ADDRESS` is unset,
  - `APP_URL` is still `http://localhost:3000`.
- Implement as a `superRefine` on the existing Zod schema — no new mechanism.

### Backups

- If MongoDB is on Atlas: enable continuous/scheduled backups in the cluster settings and record the retention policy in this doc.
- If self-hosted: nightly `mongodump` to S3 with retention is the minimum.
- Either way: perform one test restore into a scratch database and record the date it was done here. An untested backup is a hope, not a backup.
- S3 uploads bucket: enable versioning (covers accidental deletion; no separate backup job needed).

### Monitoring & alerting

- External uptime monitor (UptimeRobot or equivalent, free tier) on `GET /api/health`, alerting to the owner's email.
- Axiom: create a saved alert on error-level events if the plan supports it; otherwise a weekly manual review is acceptable at launch scale.

### Support mailbox

- Create `support@kantigo.dev` (or alias to the owner's inbox). This is the address the Terms, Privacy, and DMCA pages publish.

### Proxy/IP correctness

- Document which proxy sits in front of the app in production (Vercel, nginx, Cloudflare) and confirm the client-IP source used by rate limiting (ABUSE_AND_MODERATION_SPEC.md) reads the correct trusted header for that deployment.

### CI note

- If/when CI exists, add `npm audit --audit-level=high` and the existing `npm test` + `npm run lint` as gates. Not a launch blocker.

## Out of Scope

- Autoscaling, multi-region, staging environments, IaC — irrelevant at launch scale.
- APM/tracing beyond existing Axiom logging.

## Acceptance Checks

- Booting with `NODE_ENV=production` and default storage/email/env values exits with a clear error naming the offending variable.
- A test restore of the production database has been performed and dated in this doc.
- Killing the app triggers an uptime alert email within the monitor's check interval.
- Mail sent to the support address reaches a monitored inbox.
