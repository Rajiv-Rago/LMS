# Docker external MongoDB

- Removed the app container's dependency on a local MongoDB service.
- The running app reads `MONGODB_URI` and `AUTH_SECRET` from `.env`.
- Added build-only validation values and enabled Next.js standalone output for the Docker image.
