# Auth.js Sprint 2 Login And Logout Cutover

Moved the interactive login and logout flow to Auth.js credentials sign-in and sign-out. Login now supports Auth.js `redirectTo`, keeps the existing enrollment redirect path, and still accepts legacy `redirect` query params alongside `callbackUrl`.

Added a temporary compatibility bridge so existing protected APIs can accept either the legacy JWT cookie or the Auth.js session cookie until the Sprint 3 route-protection cutover.
