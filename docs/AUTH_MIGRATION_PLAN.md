# Auth.js Migration Plan

## Goal

Move authentication from custom JWT/session plumbing to Auth.js while preserving the current email/password product flow and adding Google, Facebook, and GitHub login later.

The migration should happen in sprints. Each sprint must leave the app in a working state and should not skip ahead until its acceptance checks pass.

## Current State

- Email/password auth is custom.
- Successful login creates a signed JWT and stores it in an HTTP-only `token` cookie.
- Login/register also create Mongo `Session` records, but normal auth only verifies the JWT and does not validate the session row.
- `/api/auth/refresh` exists but is not used by the client.
- Protected dashboard UI fetches `/api/auth/me` and redirects to `/login` on any non-200 response.
- `proxy.ts` only checks whether the cookie exists, not whether it is valid.

## Target State

- Auth.js owns auth cookies, sign-in, sign-out, session lookup, and provider callbacks.
- Existing users continue to work with email/password credentials.
- Session user data includes `id`, `role`, and `subscriptionTier`.
- Protected API routes use one app-level auth helper backed by Auth.js.
- OAuth login is available through Google, Facebook, and GitHub.
- Account linking behavior is explicit and tested.
- Custom JWT code and unused session plumbing are removed.

## Sprint 1: Auth.js Foundation

### Scope

- Install Auth.js dependencies.
- Add the Auth.js route handler.
- Add a Credentials provider using the existing `User` model and bcrypt password checks.
- Preserve existing lockout and failed-login behavior.
- Add Auth.js session typing for:
  - `user.id`
  - `user.role`
  - `user.subscriptionTier`
- Keep existing custom auth routes active during this sprint.

### Decisions

- Decide whether Sprint 1 starts with JWT sessions or database sessions.
- Recommendation: start with JWT sessions for the cutover spike, then move to database sessions in Sprint 4.

### Acceptance Checks

- Credentials login succeeds for an existing user.
- Bad credentials fail without exposing whether the email exists.
- Locked users cannot sign in.
- The Auth.js session contains `id`, `role`, and `subscriptionTier`.
- Existing custom login still works until Sprint 2 replaces it.

## Sprint 2: Login And Logout Cutover

### Scope

- Update the login page to call Auth.js `signIn("credentials")`.
- Update logout UI to call Auth.js `signOut`.
- Replace custom login redirects with Auth.js `callbackUrl`.
- Preserve the enrollment redirect flow.
- Keep register, forgot-password, and reset-password routes custom.
- Keep custom `/api/auth/me` temporarily if needed by old client code.

### Acceptance Checks

- Login redirects to the requested page after success.
- Login without a requested page redirects to `/dashboard`.
- Enrollment login still enrolls and returns to the course.
- Logout clears the Auth.js session and returns to `/login`.
- Refreshing protected pages does not randomly send a valid user to `/login`.
- Tests cover successful login, bad password, locked user, redirect, and logout.

## Sprint 3: Route Protection Cutover

### Scope

- Replace custom `authenticate()` usage with an Auth.js-backed helper.
- Preserve a small app-level wrapper API such as `requireAuth` and `requireRole` to limit route churn.
- Update protected API routes gradually.
- Update `proxy.ts` or equivalent middleware to use Auth.js session checks.
- Remove the stale-cookie behavior where the proxy allows a page but the client immediately redirects.

### Acceptance Checks

- Protected pages reject unauthenticated users.
- Protected API routes return `401` for unauthenticated requests.
- Role-protected routes still return `403` for unauthorized roles.
- Deleted or inactive users cannot continue using an old session.
- Existing course authorization tests still pass.

## Sprint 4: Session Strategy And Revocation

### Scope

- Decide final session strategy.
- Recommended final strategy: Auth.js database sessions in Mongo.
- Add the Mongo adapter if database sessions are selected.
- Replace or remove the current custom `Session` model.
- Rebuild session listing and session revocation against Auth.js-managed sessions, if still needed.
- Add "sign out everywhere" behavior if product scope requires it.

### Acceptance Checks

- Signing in creates one active Auth.js session.
- Signing out revokes the current session.
- Revoking a listed session prevents that session from authenticating again.
- Session expiration is enforced server-side.
- Old custom session rows are no longer required for auth.

## Sprint 5: OAuth Providers

### Scope

- Add Google login.
- Add GitHub login.
- Add Facebook login.
- Configure provider credentials through environment variables.
- Add provider-specific audit log events.
- Add onboarding defaults for OAuth-created users.

### Decisions

- Decide whether OAuth login auto-creates a student account.
- Decide how to handle provider emails that are missing or unverified.
- Decide whether matching verified emails should link to existing password accounts.
- Decide whether users can disconnect providers from their account.

### Acceptance Checks

- Google login works for a new user.
- GitHub login works for a new user.
- Facebook login works for a new user.
- OAuth login with an existing verified email follows the chosen linking rule.
- OAuth-created users receive the expected default role and subscription tier.
- Provider failures return users to a clear error state.

## Sprint 6: Cleanup

### Scope

- Remove custom JWT code.
- Remove unused custom auth routes:
  - `/api/auth/login`
  - `/api/auth/logout`
  - `/api/auth/refresh`
  - `/api/auth/me`, if fully replaced
- Remove unused `jsonwebtoken` dependency.
- Remove or migrate custom session tests.
- Update README auth setup instructions.
- Document required OAuth environment variables.

### Acceptance Checks

- No route uses the old custom JWT verifier.
- No UI depends on the old `token` cookie.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.
- README documents local credentials auth and OAuth setup.

## Cross-Sprint Rules

- Write tests before implementation changes.
- Keep each sprint deployable.
- Do not add OAuth until credentials login is stable under Auth.js.
- Do not delete old auth routes until replacement routes are tested.
- Keep account security behavior explicit:
  - password hashing
  - failed login tracking
  - account lockout
  - password reset
  - audit logging
  - role checks
- Prefer small compatibility wrappers over rewriting every API route at once.

## Known Risks

- Auth.js for Next currently uses the `next-auth` package, and the v5 API is still beta. Run a compatibility spike before broad route changes.
- Credentials auth still requires custom password validation and account-security code.
- Account linking is the highest-risk OAuth area. It should be tested carefully.
- Database sessions add a server-side lookup. That is acceptable for this app unless measured load says otherwise.

## Deferred Options

- Add Redis for high-frequency session lookup only if Mongo session checks become a measured bottleneck.
- Add magic-link login after OAuth is stable.
- Add passkeys after the core Auth.js migration is complete.
