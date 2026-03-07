# Deferred Items - Phase 06

## Pre-existing Issues

- **Build error on /explore page**: `useSearchParams()` not wrapped in Suspense boundary at `app/(public)/explore/page`. Causes `npm run build` to fail during static page generation. Pre-existing before Phase 06 changes.
