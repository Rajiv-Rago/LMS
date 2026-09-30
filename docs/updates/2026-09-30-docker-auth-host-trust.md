# Docker Auth.js host trust

- Set `AUTH_TRUST_HOST=true` in the Compose app environment to fix `UntrustedHost` errors in production.
- Documented container recreation and added a Jest regression test for the setting.
