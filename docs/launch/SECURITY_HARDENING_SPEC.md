# Security Hardening Spec

## Goal

Add the standard HTTP-layer protections that are currently absent and make user-uploaded file serving safe against stored XSS. Cheap, mostly configuration, done before public exposure.

## Current State

- `next.config.ts` sets no security headers — no CSP, no HSTS, no `X-Content-Type-Options`, no `Referrer-Policy`.
- `app/api/files/[...path]/route.ts` serves user-uploaded submission files with a MIME type inferred from extension, inline. An uploaded HTML or SVG file executes script in the app's origin when a grader opens it.
- Upload validation (size, allowed types per assignment) exists and stays as is.

## Target State

- Global security headers shipped from `next.config.ts` `headers()`.
- Uploaded files can never execute script in the app origin.
- A full `/security-review` pass has run on the branch and its findings are resolved.

## Scope

### Global headers (`next.config.ts`)

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY            (or CSP frame-ancestors 'none')
Strict-Transport-Security: max-age=63072000; includeSubDomains   (prod only)
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

- Content-Security-Policy: start with a report-only policy, tighten to enforcing once the console is clean. Minimum enforced at launch: `frame-ancestors 'none'; object-src 'none'; base-uri 'self'`. A full `script-src` lockdown can follow later — Next.js inline scripts make it a project of its own, and the headers above already cover clickjacking and plugin injection.

### File serving (`app/api/files/[...path]/route.ts`)

- Add `Content-Disposition: attachment; filename="..."` to all served submission files — downloads instead of rendering, which neutralizes HTML/SVG/PDF-JS payloads in one line.
- Keep `nosniff` (comes from global headers).
- If inline preview is ever wanted later, serve previews from a separate sandboxed origin or with a strict per-response CSP — not in scope now.

### Auth cookie audit

- Confirm Auth.js cookies are `Secure`, `HttpOnly`, `SameSite=Lax` in production config. Expected default, verify rather than assume.

### Review pass

- Run `/security-review` on the branch after the above lands; fix or explicitly accept each finding. This spec deliberately does not enumerate app-logic issues — the review is the tool for that.
- This is an interim gate. The full audit — whole-codebase review, manual authorization/billing checklist, attack session — happens after all other phases in SECURITY_AUDIT_SPEC.md.

## Out of Scope

- Full `script-src` CSP lockdown (tracked as a post-launch follow-up).
- WAF/CDN configuration (deployment-dependent, see OPERATIONS_SPEC.md).
- Dependency audit automation — `npm audit` in CI is a one-line add if CI exists; note it in OPERATIONS_SPEC.md.

## Acceptance Checks

- `curl -sI` against any page in production shows all headers above.
- Uploading an `.html` file as a submission and opening it downloads the file; no script executes in the app origin.
- Session cookie flags verified in the browser devtools against production.
- `/security-review` has run with zero unresolved high-severity findings.
