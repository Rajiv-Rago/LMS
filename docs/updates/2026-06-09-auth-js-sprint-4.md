# Auth.js Sprint 4 Session Strategy And Revocation

Auth.js credentials authentication remains on JWT sessions because the installed Auth.js v5 beta does not support database sessions with the Credentials provider. Auth.js JWTs now contain an opaque session ID backed by a Mongo `AuthSession` registry, so missing, revoked, or expired sessions are rejected server-side.

Sessions use a 30-day sliding expiration and can be listed, revoked individually, or revoked everywhere from Settings. Registration now creates the account and signs in through Auth.js instead of issuing a legacy custom JWT.
