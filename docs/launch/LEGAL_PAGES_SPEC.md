# Legal Pages Spec

## Goal

Publish the legal documents required for a public launch and wire consent into registration. No payments coverage yet — the Terms get a billing/refund section when payments ship (see PAYMENTS_SPEC.md).

## Current State

- No `/terms`, `/privacy`, or DMCA page exists anywhere in the app.
- The landing page footer has no legal links.
- Registration has no "I agree to the Terms" checkbox.
- Client-side Axiom analytics (`NEXT_PUBLIC_AXIOM_TOKEN`) run without consent.
- No public support or abuse contact exists.

## Target State

- `/terms`, `/privacy`, and `/legal/dmca` render as static pages under `app/(public)/`.
- Landing page and dashboard footers link to all three.
- Registration requires a checked ToS/Privacy consent box; the acceptance timestamp is stored on the user.
- A support/abuse contact email is published on the DMCA page.
- Analytics either move server-side or sit behind a consent check for the client token.

## Scope

### Pages

- `app/(public)/terms/page.tsx` — Terms of Service. Must cover: user-generated content ownership and license to display, AI-generated content accuracy disclaimer, acceptable use, account termination, minimum age 13+, limitation of liability, governing law.
- `app/(public)/privacy/page.tsx` — Privacy Policy. Must disclose: data collected (email, OAuth profile, submissions, usage), third-party processors (OpenAI, Anthropic, Google, Groq, Cerebras, YouTube Data API, email provider, Axiom, MongoDB host), cookies (auth cookies are strictly necessary), retention, and the existing export/delete rights with pointers to the Settings flows.
- `app/(public)/legal/dmca/page.tsx` — DMCA/copyright takedown process and designated contact email. Needed because users publish courses publicly and courses embed YouTube content.

Static TSX with prose content is fine; no CMS, no markdown pipeline.

### Consent wiring

- Add a required checkbox to the register form: "I agree to the Terms of Service and Privacy Policy" with links.
- Add `termsAcceptedAt: Date` to the `User` model; set it at registration. OAuth-created accounts set it on first sign-in via an interstitial or at the OAuth consent screen note — decide during implementation (interstitial is safer).
- Reject registration server-side if consent is absent, in `lib/validation/authSchemas.ts` and the register route.

### Analytics consent

- Preferred: drop `NEXT_PUBLIC_AXIOM_TOKEN` client analytics and log server-side only — avoids a cookie banner entirely.
- If client analytics stay: add a minimal consent banner that gates the Axiom client init.

## Decisions

- Legal text itself: use a reputable generator or lawyer-reviewed template as the starting point; engineering scope here is only the pages, links, and consent plumbing.
- Jurisdiction/governing law: owner decision, needed before the Terms text is final.

## Out of Scope

- Billing, refunds, subscription terms (added with payments).
- Cookie banner beyond the analytics case — auth cookies do not require one.

## Existing Users Backfill

Pre-launch users are backfilled with a one-off mongosh command against the prod DB (no prompt-on-login flow):

```js
db.users.updateMany(
  { termsAcceptedAt: { $exists: false } },
  { $set: { termsAcceptedAt: new Date() } }
)
```

## Acceptance Checks

- All three pages render unauthenticated and are linked from the landing footer.
- Registration fails without the consent checkbox, server-side, not just in the UI.
- New users have `termsAcceptedAt` set; existing users are backfilled or prompted on next login.
- Privacy Policy names every third-party processor actually configured in `lib/env.ts`.
- No client-side analytics fire before consent (or none exist).
