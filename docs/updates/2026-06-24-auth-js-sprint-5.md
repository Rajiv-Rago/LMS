# Auth.js Sprint 5 OAuth Providers

Added Google, GitHub, and Facebook sign-in through Auth.js. OAuth sign-in creates free student accounts for trusted provider emails, links trusted matching emails to existing accounts, and rejects missing or untrusted provider emails.

Linked providers are stored separately from users and shown read-only in Settings. OAuth-created users remain passwordless until they set a password through the existing reset-password flow.
