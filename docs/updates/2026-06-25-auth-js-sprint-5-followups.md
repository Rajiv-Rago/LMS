# Auth.js Sprint 5 Follow-ups

## OAuth failure messages

OAuth failures currently return users to the auth flow without a clear app-owned message. The login page should read the Auth.js error query parameter and show a short explanation, such as:

- The provider did not return a usable email.
- This provider is already linked to another account.
- Sign in to your account first before linking a new provider.

Keep the message generic enough to avoid account enumeration.

## OAuth session display

Password sign-in stores real request metadata for active sessions. OAuth sign-in currently stores placeholder metadata, so Settings cannot show useful device/browser details for those sessions.

Minimal fix: display OAuth sessions as "OAuth sign-in" instead of showing fake IP or browser values.

Better fix: pass real request metadata into OAuth session creation if Auth.js exposes it cleanly in the callback path.

## Future security hardening

Rate limits, abuse detection, and anti-DDoS controls are separate from OAuth account-linking. They help reduce repeated attacks and traffic spikes, but they do not prevent a single incorrect account link.

Track these for a later security update, especially on auth routes, password reset, registration, and AI generation endpoints.

## Close-out (2026-06-30)

Sprint 5 is complete. Resolved in this pass:

- **OAuth failure messages** — the login page maps the `AccessDenied` error to a single,
  enumeration-safe message; distinct per-reason copy was intentionally not added.
- **OAuth session display** — Settings → Active Sessions now renders OAuth sessions as
  "OAuth sign-in" and omits the placeholder IP, detected via the existing `ip === "oauth"`
  marker.
- **Disconnect providers** — added `DELETE /api/auth/providers/[provider]` with a lockout
  guard (a passwordless user cannot remove their only sign-in method) and an
  `oauth.account.unlinked` audit event, plus a Disconnect control in Settings.

Still deferred: rate limiting / abuse detection on auth routes — tracked for a later
security update.
