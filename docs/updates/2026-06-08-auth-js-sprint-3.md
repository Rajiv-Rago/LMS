# Auth.js Sprint 3 Route Protection Cutover

Protected route authentication now uses Auth.js sessions only. The shared auth helper no longer accepts the legacy custom JWT cookie or bearer token for protected routes, and it validates the Auth.js session user against the active Mongo user record before returning role and subscription data.

The proxy now checks Auth.js session state instead of cookie presence, so stale session cookies redirect to login instead of reaching protected pages. Role-protected admin trash routes now distinguish unauthenticated `401` responses from authenticated non-admin `403` responses.
