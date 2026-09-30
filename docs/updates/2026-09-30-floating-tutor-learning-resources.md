# Floating tutor and lesson learning resources

- Added a shared course tutor with persistent conversations, page focus, Markdown answers, compact model settings, and recoverable errors. Quiz loading and active attempts hide it; the full-page tutor and history remain available.
- Chat resolves saved lesson, module, overview, and assignment context on the server, validates course membership and session ownership, and excludes answer keys and submissions. Video/file context contains saved descriptions and metadata only. Chat sessions support every configured provider, including OpenRouter.
- Moved lesson improvement and replacement actions into a keyboard-accessible title menu and native dialogs. Regeneration and Undo preserve text, takeaways, citations, and recommendations together.
- Added optional lesson learning resources and separate collapsible citations. Generation selects recommendations from inspected public pages; failure does not fail the lesson. Editors and shared users can refresh recommendations for one AI credit, with duplicate-request protection and failure recovery.
- Older lessons need no migration or automatic resource backfill. Reliable search uses the existing optional `BRAVE_SEARCH_API_KEY`; only successfully inspected URLs can appear as recommendations.

Verification: 107 unit/component tests and 81 integration tests passed, along with TypeScript checks and the production build. Lint passed with one existing warning in `lib/storage/local.ts`. Desktop/mobile and light/dark browser inspection remains unverified because no browser is connected in this session.
