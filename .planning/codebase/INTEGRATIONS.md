# External Integrations

**Analysis Date:** 2026-03-05

## AI Provider System

The AI subsystem uses a provider pattern with a common `AIProvider` interface (`lib/ai/types.ts`). All providers implement `chat()` and `generateText()` methods. Provider resolution follows a 6-level priority chain defined in `lib/ai/utils/providerResolver.ts`.

**Factory:** `createAIProvider(config)` in `lib/ai/index.ts`

**OpenAI:**
- SDK: `openai` (`^6.17.0`)
- Implementation: `lib/ai/providers/openai.ts`
- Auth: `OPENAI_API_KEY` env var
- Default model: `gpt-4o-mini`
- Tier models: `gpt-4.1-nano-2025-04-14` (concise), `gpt-4.1-mini-2025-04-14` (balanced), `gpt-4.1-2025-04-14` (thorough)

**Anthropic:**
- SDK: `@anthropic-ai/sdk` (`^0.72.1`)
- Implementation: `lib/ai/providers/anthropic.ts`
- Auth: `ANTHROPIC_API_KEY` env var
- Default model: `claude-3-haiku-20240307`
- Tier models: `claude-haiku-4-5-20251001` (concise), `claude-sonnet-4-20250514` (balanced), `claude-opus-4-20250514` (thorough)

**Google Gemini:**
- SDK: `@google/generative-ai` (`^0.24.1`)
- Implementation: `lib/ai/providers/gemini.ts`
- Auth: `GEMINI_API_KEY` env var
- Default model: `gemini-1.5-flash`
- Tier models: `gemini-2.0-flash` (concise), `gemini-2.5-pro` (balanced, thorough)

**Groq:**
- SDK: `openai` (OpenAI-compatible API via custom `baseURL: "https://api.groq.com/openai/v1"`)
- Implementation: `lib/ai/providers/groq.ts`
- Auth: `GROQ_API_KEY` env var
- Default model: `llama-3.3-70b-versatile`
- Tier models: `llama-3.3-70b-versatile` (concise only)

**Cerebras:**
- SDK: `openai` (OpenAI-compatible API via custom `baseURL: "https://api.cerebras.ai/v1"`)
- Implementation: `lib/ai/providers/cerebras.ts`
- Auth: `CEREBRAS_API_KEY` env var
- Default model: `gpt-oss-120b`
- Tier models: `llama-3.3-70b` (concise only)

**Provider Resolution Priority** (`lib/ai/utils/providerResolver.ts`):
1. Request explicit provider+model
2. Request tier (via `lib/ai/utils/tierCatalog.ts` - tries candidates in priority order until one has an API key)
3. Course preferences (`course.aiPreferences`)
4. User preferences (`user.aiPreferences`)
5. Environment variables (`AI_PROVIDER` / `AI_MODEL`)
6. Fallback: OpenAI

**Model Registry:** `lib/ai/utils/modelRegistry.ts` - Central registry mapping model IDs to display names, providers, and tier membership.

**AI Services built on providers:**
- `lib/ai/services/syllabusGenerator.ts` - Course syllabus generation
- `lib/ai/services/lessonContentGenerator.ts` - Lesson content generation
- `lib/ai/services/tutor.ts` - AI tutor chat
- `lib/ai/services/generator.ts` - General content generation

## YouTube Data API

- API: YouTube Data API v3
- Auth: `YOUTUBE_API_KEY` env var
- Client: `@youtube-core/youtubeSearch` (from git submodule `packages/youtube-learning-path/src/core/`)
- Service: `lib/youtube/youtubePathService.ts` - Orchestrates YouTube search, deduplication, LLM curriculum structuring
- Prompt builder: `lib/youtube/youtubePathPrompt.ts`
- Types: `lib/youtube/types.ts`
- API route: `app/api/courses/youtube/generate/route.ts` - Enqueues job, returns `{ jobId }` with 202 status
- Job handler: `lib/queue/handlers/youtubeGeneration.ts` - Creates Course, Modules, Lessons (with `youtubeMetadata`), Assignments
- YouTube search route: `app/api/youtube/search/route.ts`

## Data Storage

**Database:**
- MongoDB via Mongoose 8 (`mongoose@^8.19.2`)
- Connection: `lib/db.ts` - Cached singleton, auto-reconnect on failure
- Connection env var: `MONGODB_URI`
- Test DB env var: `MONGODB_URI_TEST`
- Transaction support: `withTransaction()` helper in `lib/db.ts` with graceful fallback for standalone (non-replica-set) instances
- Soft-delete support: Custom `QueryOptions.includeSoftDeleted` augmentation on Mongoose

**Models** (all in `lib/models/`):
- `User.ts`, `Course.ts`, `Module.ts`, `Lesson.ts`
- `Assignment.ts`, `Submission.ts`
- `AIChatSession.ts`, `AIGeneratedContent.ts`, `AIGenerationLog.ts`, `AIUsage.ts`
- `Job.ts` (queue jobs), `Session.ts` (auth sessions)
- `Notification.ts`, `AuditLog.ts`, `Migration.ts`

**File Storage:**
- Interface: `lib/storage/index.ts` (`FileStorage` - `upload`, `delete`, `getSignedUrl`)
- Factory: `lib/storage/factory.ts` - Resolves provider via `STORAGE_PROVIDER` env var
- Local: `lib/storage/local.ts` - Writes to `data/uploads/`, serves via `/api/files/`
- S3: `lib/storage/s3.ts` - Uses `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
  - Auth: `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (or IAM role)
  - Config: `S3_BUCKET`, `S3_REGION` (default: `us-east-1`)
- File serving API: `app/api/files/[...path]/route.ts`

**Caching:**
- None (no Redis/Memcached in current dependencies)

## Authentication & Identity

**Auth Provider:** Custom JWT-based authentication
- Implementation: `lib/auth/jwt.ts` - Sign/verify/decode tokens via `jsonwebtoken`
- Password hashing: `bcryptjs`
- Token storage: httpOnly cookie named `token`
- Token lifetime: 7 days (configurable via `JWT_EXPIRES_IN`)
- Refresh: 1-hour grace period for expired tokens (`verifyTokenForRefresh`)
- CSRF: Custom header check (`x-requested-with: XMLHttpRequest`) on mutation methods
- Middleware HOFs: `requireAuth`, `requireRole` in `lib/auth/middleware.ts`
- Cookie helpers: `setAuthCookie`, `clearAuthCookie` in `lib/auth/middleware.ts`
- Session management: `lib/models/Session.ts`, API routes at `app/api/auth/sessions/`
- Course ownership: `lib/auth/courseOwnership.ts` - Authorization helpers for course access

**Roles:** `student`, `teacher`, `admin`
**Subscription Tiers:** `free`, `plus`, `admin` (stored in JWT payload)

**Auth API Routes:**
- `app/api/auth/register/route.ts` - User registration
- `app/api/auth/login/route.ts` - Login
- `app/api/auth/logout/route.ts` - Logout
- `app/api/auth/me/route.ts` - Current user info
- `app/api/auth/refresh/route.ts` - Token refresh
- `app/api/auth/forgot-password/route.ts` - Password reset request
- `app/api/auth/reset-password/route.ts` - Password reset execution

## Email

- Interface: `lib/email/types.ts` (`EmailProvider` - `send(EmailMessage)`)
- Factory: `lib/email/index.ts` - Resolves provider via `EMAIL_PROVIDER` env var
- Templates: `lib/email/templates.ts` (currently: password reset only)

**Providers:**
- Console (default): `lib/email/providers/console.ts` - Logs to terminal
- Resend: `lib/email/providers/resend.ts` - Dynamic import of `resend` SDK (optional peer dep)
  - Auth: `RESEND_API_KEY`
- SendGrid: `lib/email/providers/sendgrid.ts` - Dynamic import of `@sendgrid/mail` (optional peer dep)
  - Auth: `SENDGRID_API_KEY`
- AWS SES: `lib/email/providers/ses.ts` - Dynamic import of `@aws-sdk/client-ses` (optional peer dep)
  - Auth: AWS credentials (env vars or IAM role), `AWS_REGION`

**Config:** `EMAIL_FROM_ADDRESS` (from address), `APP_NAME` (used in email templates)

## Job Queue

- Interface: `lib/queue/index.ts` (`QueueAdapter` - `enqueueJob`, `getJobStatus`)
- Enabled via: `QUEUE_ENABLED` env var (default: `false`)

**Backends:**
- Sync shim (default): `lib/queue/syncShim.ts` - Executes jobs synchronously (no queue)
- MongoDB queue: `lib/queue/mongoQueue.ts` - Stores jobs in `Job` collection
- Worker: `lib/queue/worker.ts` - Polls and processes pending jobs

**Job Handlers:**
- `lib/queue/handlers/aiGeneration.ts` - AI syllabus/lesson generation
- `lib/queue/handlers/youtubeGeneration.ts` - YouTube learning path generation

**Future:** Redis backend planned (`REDIS_URL` env var exists but unused)

## Monitoring & Observability

**Logging:**
- Custom logger: `lib/logger.ts` - Structured JSON (production) or human-readable (development)
- Dual output: Console (always) + Axiom (when configured)
- `captureException()` for structured error logging
- `flushAxiom()` for serverless function teardown

**Axiom (optional):**
- Implementation: `lib/axiom.ts` - Lazy-initialized, server-only
- Uses `AxiomWithoutBatching` for reliable serverless delivery (no batch timer that could be killed)
- SDKs: `@axiomhq/js`, `@axiomhq/logging`, `@axiomhq/nextjs`
- Auth: `NEXT_PUBLIC_AXIOM_DATASET`, `NEXT_PUBLIC_AXIOM_TOKEN`
- Web vitals route: `app/api/axiom/route.ts`

**Error Tracking:** No dedicated service (Sentry, etc.) - errors go to Axiom/console only

**Health Check:** `app/api/health/route.ts`

## Notifications

- Model: `lib/models/Notification.ts`
- API routes: `app/api/notifications/route.ts`, `app/api/notifications/[id]/route.ts`
- SSE stream: `app/api/notifications/stream/route.ts`

## CI/CD & Deployment

**Hosting:** Vercel-optimized (serverless functions, `AxiomWithoutBatching`, Next.js framework)
**CI Pipeline:** Not detected in repository configuration

## Validation

- Framework: Zod 4 (`zod@^4.3.6`)
- Environment validation: `lib/env.ts` (validates all env vars at startup)
- Request validation schemas: `lib/validation/aiSchemas.ts`, `lib/validation/authSchemas.ts`, `lib/validation/commonSchemas.ts`, `lib/validation/youtubeSchemas.ts`

## AI Rate Limiting

- Enabled via: `AI_RATE_LIMIT_ENABLED` env var (default: `true`)
- Usage tracking model: `lib/models/AIUsage.ts`

## User Data Management

- Account deletion: `app/api/users/me/delete/route.ts`
- Data export: `app/api/users/me/export/route.ts`
- AI preferences: `app/api/users/preferences/route.ts`

## Environment Configuration

**Required env vars:**
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Min 32 characters for JWT signing

**Required for features:**
- At least one of: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY` (for AI features)
- `YOUTUBE_API_KEY` (for YouTube learning paths)
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (when `STORAGE_PROVIDER=s3`)
- `SENDGRID_API_KEY` or `RESEND_API_KEY` (when using those email providers)

**Optional with defaults:**
- `AI_PROVIDER` (default: `openai`)
- `STORAGE_PROVIDER` (default: `local`)
- `EMAIL_PROVIDER` (default: `console`)
- `QUEUE_ENABLED` (default: `false`)
- `AI_RATE_LIMIT_ENABLED` (default: `true`)
- `JWT_EXPIRES_IN` (default: `7d`)
- `APP_URL` (default: `http://localhost:3000`)
- `APP_NAME` (default: `Kantigo`)
- `NODE_ENV` (default: `development`)

**Secrets location:** `.env` file (gitignored), `.env.example` for documentation

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

---

*Integration audit: 2026-03-05*
