# Technology Stack

**Analysis Date:** 2026-03-05

## Languages

**Primary:**
- TypeScript 5 (strict mode) - All application code (frontend, API routes, library modules)

**Secondary:**
- JavaScript (ESM) - Configuration files only (`eslint.config.mjs`, `postcss.config.mjs`)

## Runtime

**Environment:**
- Node.js 22.17.0

**Package Manager:**
- npm 11.7.0
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16 (`next@^16.1.6`) - Full-stack framework with App Router, Turbopack dev server
- React 19 (`react@19.2.0`) - UI rendering
- Tailwind CSS 4 (`tailwindcss@^4`) - Utility-first CSS via PostCSS plugin (`@tailwindcss/postcss@^4`)

**Testing:**
- Jest 30 (`jest@^30.2.0`) - Test runner with `next/jest` integration
- `@testing-library/jest-dom` (`^6.9.1`) - DOM assertion matchers
- `mongodb-memory-server` (`^11.0.1`) - In-memory MongoDB for integration tests

**Build/Dev:**
- TypeScript 5 (`typescript@^5`) - Type checking (strict mode, `noEmit`)
- ESLint 9 with `eslint-config-next` (core-web-vitals + typescript presets) - Config: `eslint.config.mjs`
- PostCSS with `@tailwindcss/postcss` plugin - Config: `postcss.config.mjs`
- tsx (`tsx@^4.21.0`) - TypeScript execution for scripts (`npm run migrate`, `npm run seed`)
- Turbopack - Next.js dev server bundler (configured in `next.config.ts`)

## Key Dependencies

**Critical:**
- `mongoose` (`^8.19.2`) - MongoDB ODM, all data models and queries
- `jsonwebtoken` (`^9.0.3`) - JWT-based authentication (sign/verify tokens)
- `bcryptjs` (`^3.0.3`) - Password hashing for user registration/login
- `zod` (`^4.3.6`) - Runtime schema validation (env vars, request bodies, AI schemas)
- `dotenv` (`^17.2.3`) - Environment variable loading

**AI SDKs:**
- `openai` (`^6.17.0`) - OpenAI API client (also used as base for Groq and Cerebras via custom `baseURL`)
- `@anthropic-ai/sdk` (`^0.72.1`) - Anthropic Claude API client
- `@google/generative-ai` (`^0.24.1`) - Google Gemini API client

**Infrastructure:**
- `@aws-sdk/client-s3` (`^3.995.0`) - S3 file storage (optional, when `STORAGE_PROVIDER=s3`)
- `@aws-sdk/s3-request-presigner` (`^3.995.0`) - Pre-signed URL generation for S3 objects
- `@axiomhq/js` (`^1.4.0`) + `@axiomhq/logging` (`^0.2.0`) + `@axiomhq/nextjs` (`^0.2.0`) - Axiom log transport (optional)

**Content Rendering:**
- `react-markdown` (`^10.1.0`) - Markdown rendering in the UI
- `remark-gfm` (`^4.0.1`) - GitHub Flavored Markdown support
- `@tailwindcss/typography` (`^0.5.19`) - Prose styling for rendered markdown

## Configuration

**Environment:**
- Validated at startup via Zod schema in `lib/env.ts`
- Required vars: `MONGODB_URI`, `JWT_SECRET` (min 32 chars)
- Optional vars with defaults: `AI_PROVIDER` (default: `"openai"`), `STORAGE_PROVIDER` (default: `"local"`), `EMAIL_PROVIDER` (default: `"console"`), `QUEUE_ENABLED` (default: `"false"`)
- `.env.example` documents all available variables with descriptions

**Build:**
- `tsconfig.json` - Target ES2017, module bundler resolution, strict mode, incremental builds
- `next.config.ts` - Turbopack resolve alias for `@youtube-core`
- `jest.config.ts` - Node test environment, `next/jest` base, 30% coverage thresholds, `@/*` path alias mapped
- `jest.setup.ts` - Sets test env defaults for `JWT_SECRET` and `MONGODB_URI`, 15s timeout

**Path Aliases:**
- `@/*` maps to project root (`./`)
- `@youtube-core/*` maps to `./packages/youtube-learning-path/src/core/*`

## Scripts

```bash
npm run dev              # Start Next.js dev server (Turbopack)
npm run build            # Production build
npm start                # Start production server
npm test                 # Run Jest tests
npm run test:watch       # Jest in watch mode
npm run test:coverage    # Jest with coverage report
npm run lint             # ESLint
npm run migrate          # Run database migrations via tsx
npm run seed             # Seed database via tsx
```

## Git Submodule

**`packages/youtube-learning-path/`**
- External repo for YouTube search and video filtering utilities
- Only `src/core/` is imported (standalone app code is excluded from compilation and linting via `tsconfig.json` excludes and `eslint.config.mjs` global ignores)
- Imported via `@youtube-core/*` path alias

## Platform Requirements

**Development:**
- Node.js 22+
- MongoDB (local or Atlas) - standalone or replica set
- At least one AI provider API key for AI features
- YouTube Data API v3 key for YouTube learning path generation

**Production:**
- Vercel-compatible (serverless functions, `AxiomWithoutBatching` for reliable log flushing)
- MongoDB Atlas (connection includes IP whitelist error handling in `lib/db.ts`)
- Optional: S3-compatible storage, Redis (future queue backend)

---

*Stack analysis: 2026-03-05*
