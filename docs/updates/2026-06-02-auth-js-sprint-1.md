# Auth.js Sprint 1 Foundation

Added an Auth.js v5 credentials foundation alongside the existing custom auth routes. The new `/api/auth/[...nextauth]` handler uses JWT sessions and shares the same email/password authorization rules, failed-login counter, 15-minute lockout, and audit events expected by the current login flow.

The legacy `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, register, reset, and session endpoints remain active for this sprint. UI login migration and route protection changes are deferred to later sprints.
