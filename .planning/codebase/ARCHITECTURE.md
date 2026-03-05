# Architecture

**Analysis Date:** 2026-03-05

## Pattern Overview

**Overall:** Server-rendered Next.js App Router application with client-side interactivity and a MongoDB-backed job queue for async AI operations.

**Key Characteristics:**
- Next.js 16 App Router with route groups for auth/dashboard separation
- JWT-based authentication via httpOnly cookies (edge middleware + API-level checks)
- Multi-provider AI system with tier-based resolution (concise/balanced/thorough)
- MongoDB-backed job queue with polling worker for long-running AI generation
- Soft-delete pattern on Course, Assignment, and Submission models
- Provider/factory pattern used across AI, email, storage, and queue subsystems

## Layers

**Edge Middleware Layer:**
- Purpose: Rate limiting on auth endpoints, auth token check for dashboard routes, security headers
- Location: `middleware.ts`
- Contains: In-memory rate limiter, auth redirect logic, security header injection (CSP, HSTS, X-Frame-Options)
- Depends on: `lib/utils/request.ts` for IP extraction
- Used by: All incoming requests matching the matcher config

**API Route Layer:**
- Purpose: HTTP request handling, validation, authorization, response formatting
- Location: `app/api/`
- Contains: Next.js Route Handlers exporting named HTTP method functions (GET, POST, PATCH, DELETE)
- Depends on: `lib/auth/`, `lib/models/`, `lib/validation/`, `lib/queue/`, `lib/cache.ts`, `lib/logger.ts`
- Used by: Client-side fetch calls from dashboard pages
- Pattern: Each route follows authenticate -> validate (Zod) -> dbConnect -> business logic -> NextResponse.json()

**Authentication Layer:**
- Purpose: JWT signing/verification, auth middleware HOFs, session management, course ownership checks
- Location: `lib/auth/`
- Contains: `jwt.ts` (sign/verify/decode), `middleware.ts` (requireAuth, requireRole, requireCsrf, setAuthCookie), `courseOwnership.ts` (ownership checks), `auditLog.ts` (security event logging)
- Depends on: `lib/models/User.ts`, `lib/models/Session.ts`, `lib/models/AuditLog.ts`
- Used by: All API routes requiring authentication
- Key export: `lib/auth/index.ts` barrel file re-exports everything

**Data Model Layer:**
- Purpose: MongoDB schema definitions, Mongoose models with validation and hooks
- Location: `lib/models/`
- Contains: 14 Mongoose models (User, Course, Module, Lesson, Assignment, Submission, AIChatSession, AIGeneratedContent, AIGenerationLog, AuditLog, Session, Notification, Job, Migration, AIUsage)
- Depends on: `mongoose`, `bcryptjs` (User model only)
- Used by: API routes, queue handlers, services
- Key export: `lib/models/index.ts` barrel file

**AI Provider Layer:**
- Purpose: Abstraction over multiple LLM providers with a common interface
- Location: `lib/ai/providers/`
- Contains: Provider implementations (OpenAI, Anthropic, Gemini, Groq, Cerebras) each implementing `AIProvider` interface
- Depends on: SDK packages (openai, @anthropic-ai/sdk, @google/generative-ai)
- Used by: AI services layer
- Interface: `AIProvider.chat()` and `AIProvider.generateText()` defined in `lib/ai/types.ts`

**AI Services Layer:**
- Purpose: Higher-level AI operations that compose provider calls with prompt engineering and response parsing
- Location: `lib/ai/services/`
- Contains: `SyllabusGeneratorService`, `LessonContentGeneratorService`, `AITutorService`, `AIContentGenerator`
- Depends on: AI provider layer via `createAIProvider()` factory
- Used by: Queue job handlers

**AI Resolution Layer:**
- Purpose: Resolves which AI provider/model to use based on a 6-level priority chain
- Location: `lib/ai/utils/`
- Contains: `providerResolver.ts` (6-level priority resolution), `tierCatalog.ts` (tier-to-provider mapping), `modelRegistry.ts` (model metadata), `apiKeys.ts` (env var mapping), `userPreferences.ts` (user preference loading)
- Depends on: Environment variables for API keys
- Used by: Queue handlers, API routes

**Queue System:**
- Purpose: Async job processing for long-running AI generation tasks
- Location: `lib/queue/`
- Contains: `index.ts` (adapter interface + lazy loading), `mongoQueue.ts` (MongoDB-backed queue), `syncShim.ts` (synchronous fallback for dev), `worker.ts` (polling worker)
- Depends on: `lib/models/Job.ts`, `lib/db.ts`
- Used by: API routes enqueue jobs; worker processes them
- Toggle: `QUEUE_ENABLED` env var switches between MongoQueue (async) and SyncShim (blocking)

**Queue Handlers:**
- Purpose: Business logic for async jobs (AI generation, YouTube path generation)
- Location: `lib/queue/handlers/`
- Contains: `aiGeneration.ts` (syllabus/module/lesson generation), `youtubeGeneration.ts` (YouTube path generation)
- Depends on: AI services, models, provider resolver, notifications
- Used by: Queue worker via handler registry

**YouTube Integration Layer:**
- Purpose: YouTube-based learning path generation using external submodule
- Location: `lib/youtube/` (service layer), `packages/youtube-learning-path/src/core/` (imported core)
- Contains: `YouTubePathService` (orchestrates search -> LLM structuring -> parsing), `youtubePathPrompt.ts` (prompt templates), `types.ts`
- Depends on: `@youtube-core/*` path alias -> `packages/youtube-learning-path/src/core/*`
- Used by: `lib/queue/handlers/youtubeGeneration.ts`

**Validation Layer:**
- Purpose: Request body validation using Zod schemas
- Location: `lib/validation/`
- Contains: `authSchemas.ts` (login, register, forgot/reset password), `aiSchemas.ts` (tier/provider selection, content generation), `commonSchemas.ts` (httpUrl), `youtubeSchemas.ts`
- Depends on: `zod`
- Used by: API routes

**Storage Layer:**
- Purpose: File upload/download abstraction with pluggable backends
- Location: `lib/storage/`
- Contains: `index.ts` (FileStorage interface), `factory.ts` (lazy-loading factory), `local.ts` (local filesystem), `s3.ts` (S3)
- Depends on: `STORAGE_PROVIDER` env var
- Used by: File upload API routes

**Email Layer:**
- Purpose: Transactional email sending with pluggable providers
- Location: `lib/email/`
- Contains: `index.ts` (provider resolution + send), `types.ts` (interfaces), `templates.ts` (HTML templates), `providers/` (console, sendgrid, ses, resend)
- Depends on: `EMAIL_PROVIDER` env var
- Used by: Auth routes (password reset)

**Notification Layer:**
- Purpose: In-app notifications persisted to MongoDB, delivered via SSE
- Location: `lib/notifications.ts` (creation), `app/api/notifications/stream/route.ts` (SSE delivery)
- Contains: `sendNotification()` utility, SSE streaming endpoint
- Depends on: `lib/models/Notification.ts`
- Used by: Queue handlers (job completion), `components/ui/NotificationBell.tsx` (client)

**Client Components Layer:**
- Purpose: Reusable React components for UI features
- Location: `components/`
- Contains: Feature-organized components (quiz/, project/, ai/, lesson/, course/, ui/)
- Depends on: React 19, client-side fetch to API routes
- Used by: Dashboard page components

**Hooks Layer:**
- Purpose: Reusable client-side React hooks
- Location: `lib/hooks/`
- Contains: `useJobPoller.ts` (poll job status), `useConfirm.ts` (confirmation dialogs), `useToast.ts` (toast notifications), `useUserAIDefaults.ts` (user AI preferences)
- Used by: Dashboard pages and components

**Infrastructure:**
- Purpose: Cross-cutting concerns (DB, logging, caching, env validation)
- Location: `lib/db.ts`, `lib/logger.ts`, `lib/cache.ts`, `lib/env.ts`, `lib/axiom.ts`
- `db.ts`: Cached Mongoose connection, `withTransaction()` helper
- `logger.ts`: Structured logging to console + Axiom, `captureException()` for error tracking
- `cache.ts`: In-memory LRU cache (Map-based, 1000 entries max)
- `env.ts`: Zod-validated environment variables with fail-fast on startup

## Data Flow

**Authentication Flow:**

1. User submits login form -> `POST /api/auth/login`
2. Route validates with `loginSchema`, calls `dbConnect()`, finds user, checks password via `user.comparePassword()`
3. On success: signs JWT via `signToken(user)`, creates Session record, sets httpOnly cookie via `setAuthCookie()`
4. Dashboard layout (`app/(dashboard)/layout.tsx`) fetches `GET /api/auth/me` on mount, redirects to `/login` if 401
5. Subsequent API calls: `authenticate(request)` extracts token from cookie/header, calls `verifyToken()`

**AI Course Generation Flow:**

1. User submits topic/level -> `POST /api/courses/ai/syllabus`
2. Route validates input, enforces AI rate limit (`enforceAIRateLimit()`), resolves provider (fail-fast check)
3. Route enqueues `ai.generate-syllabus` job via `enqueueJob()`, returns `{ jobId }` with 202 status
4. Queue worker polls for pending jobs, claims job atomically via `findOneAndUpdate`
5. Handler resolves AI provider, calls `SyllabusGeneratorService.generateSyllabus()`
6. Handler creates Course + Modules + Lessons in MongoDB
7. If `includeVideos`, fills video lessons with YouTube search results
8. Logs generation via `logAIGeneration()`, sends notification via `sendNotification()`
9. Client polls `GET /api/jobs/{jobId}` via `useJobPoller` hook until completed/failed
10. On completion, client navigates to `/courses/{courseId}`

**Module Content Generation Flow:**

1. User triggers generation on a module -> API enqueues `ai.generate-module-content`
2. Handler iterates lessons sequentially, generating content with `LessonContentGeneratorService`
3. Each lesson's `generationStatus` transitions: `skeleton` -> `generating` -> `completed`/`failed`
4. Previous lesson key takeaways are used as context for subsequent lessons
5. Module `contentStatus` recalculated after all lessons processed

**YouTube Path Generation Flow:**

1. User submits topic -> `POST /api/courses/youtube/generate`
2. Route enqueues `ai.generate-youtube-path` job
3. Handler calls `YouTubePathService.generatePath()`: searches YouTube (via submodule's `searchYouTubeVideos`), sends video list to LLM for structuring, parses JSON response
4. Handler creates Course + Modules + video Lessons + practice project Assignments

**State Management:**
- Server state: MongoDB (all persistent data)
- Client state: React `useState`/`useEffect` per page (no global state library)
- Auth state: Dashboard layout fetches user on mount, passes via prop drilling or re-fetching per page
- Job state: Polling via `useJobPoller` hook with interval-based `fetch`
- Notifications: SSE stream via `ReadableStream` at `GET /api/notifications/stream`

## Key Abstractions

**AIProvider Interface:**
- Purpose: Uniform API across LLM providers (OpenAI, Anthropic, Gemini, Groq, Cerebras)
- Definition: `lib/ai/types.ts`
- Examples: `lib/ai/providers/openai.ts`, `lib/ai/providers/anthropic.ts`
- Factory: `createAIProvider(config)` in `lib/ai/index.ts`
- Pattern: Strategy pattern -- each provider implements `chat()` and `generateText()`

**QueueAdapter Interface:**
- Purpose: Swappable queue backend (MongoDB or synchronous shim)
- Definition: `lib/queue/index.ts`
- Examples: `lib/queue/mongoQueue.ts`, `lib/queue/syncShim.ts`
- Pattern: Adapter pattern with lazy initialization via `getAdapter()`

**FileStorage Interface:**
- Purpose: Swappable file storage backend (local filesystem or S3)
- Definition: `lib/storage/index.ts`
- Examples: `lib/storage/local.ts`, `lib/storage/s3.ts`
- Factory: `getStorage()` in `lib/storage/factory.ts`

**EmailProvider Interface:**
- Purpose: Swappable email transport (console, SendGrid, SES, Resend)
- Definition: `lib/email/types.ts`
- Examples: `lib/email/providers/console.ts`, `lib/email/providers/sendgrid.ts`

**JobHandler Type:**
- Purpose: Registered async handlers for background job types
- Definition: `lib/queue/handlers/index.ts`
- Examples: `lib/queue/handlers/aiGeneration.ts`, `lib/queue/handlers/youtubeGeneration.ts`
- Pattern: Handler registry pattern -- handlers self-register via `registerHandler(type, fn)`, loaded eagerly in `handlersReady` promise

**Auth Middleware HOFs (requireAuth, requireRole):**
- Purpose: Wrap API route handlers with authentication/authorization checks
- Definition: `lib/auth/middleware.ts`
- Pattern: Higher-order function wrapping route handler signature `(request, context, user) => Promise<NextResponse>`

## Entry Points

**Next.js App (`app/layout.tsx`):**
- Location: `app/layout.tsx`
- Triggers: All page loads
- Responsibilities: Root HTML structure, font loading, ToastProvider + ConfirmProvider context, dark mode flash prevention script

**Landing Page (`app/page.tsx`):**
- Location: `app/page.tsx`
- Triggers: Unauthenticated root access
- Responsibilities: Marketing/landing page with links to login/register

**Auth Route Group (`app/(auth)/layout.tsx`):**
- Location: `app/(auth)/layout.tsx`
- Triggers: `/login`, `/register`, `/forgot-password`, `/reset-password`
- Responsibilities: Centered card layout, no sidebar

**Dashboard Route Group (`app/(dashboard)/layout.tsx`):**
- Location: `app/(dashboard)/layout.tsx`
- Triggers: All authenticated routes (`/dashboard`, `/courses`, `/profile`, `/settings`)
- Responsibilities: Sidebar navigation, user fetch from `/api/auth/me`, auth redirect, dark mode toggle, notification bell

**Edge Middleware (`middleware.ts`):**
- Location: `middleware.ts`
- Triggers: All requests (except static files per matcher config)
- Responsibilities: Auth-endpoint rate limiting, dashboard route auth redirect, security headers

**Instrumentation (`instrumentation.ts`):**
- Location: `instrumentation.ts`
- Triggers: Next.js server startup (Node.js runtime only)
- Responsibilities: Starts queue worker when `QUEUE_ENABLED=true`

**API Routes (`app/api/`):**
- Location: `app/api/**/**/route.ts` (~50 route files)
- Triggers: Client fetch calls, external HTTP requests
- Responsibilities: REST API for all data operations

## Error Handling

**Strategy:** Try-catch at route handler level with structured error logging via `captureException()`

**Patterns:**
- API routes wrap entire handler in try-catch, return `{ error: "Internal server error" }` with 500 status
- `captureException(error, { operation: "..." })` logs to console + Axiom with structured context
- Validation errors return first Zod issue message with 400 status: `validation.error.issues[0].message`
- Auth failures return 401 ("Unauthorized") or 403 ("Forbidden")
- Non-critical operations (notifications, audit logs) catch errors silently to avoid breaking the main flow
- Queue worker: failed jobs retry with exponential backoff (2s, 4s, 8s), max 3 attempts
- Database connection errors throw `DatabaseConnectionError` with descriptive messages
- AI provider errors are caught per-lesson during module generation; individual lesson failures don't abort the module

## Cross-Cutting Concerns

**Logging:**
- `lib/logger.ts` provides `logger.info/warn/error()` and `captureException()`
- Dev: human-readable format with timestamps
- Production: JSON format for structured logging
- Axiom transport for production observability (when configured)
- Audit logging for security events via `lib/auth/auditLog.ts`

**Validation:**
- Zod schemas in `lib/validation/` for request body validation
- `safeParse()` pattern at the start of API route handlers
- Mongoose schema validation as secondary layer (required fields, maxlength, enum)
- Environment variables validated at startup via `lib/env.ts` Zod schema

**Authentication:**
- JWT in httpOnly cookie (7-day expiry by default)
- Edge middleware checks cookie existence for dashboard routes (redirect to login)
- API routes call `authenticate(request)` to verify JWT signature
- CSRF protection via `X-Requested-With: XMLHttpRequest` header on mutations
- Rate limiting: in-memory per-instance for auth endpoints, MongoDB-backed for AI usage

**Caching:**
- In-memory LRU cache in `lib/cache.ts` (1000 entries, TTL-based)
- Used for course data; invalidated on mutations via `cache.invalidate()` and `cache.invalidatePrefix()`
- Database connection cached globally via `global._mongoose`

**Soft Delete:**
- Course, Assignment, and Submission models use `deletedAt: Date | null`
- Mongoose `pre(/^find/)` hook auto-filters `deletedAt: null` unless `{ includeSoftDeleted: true }` option is passed
- Admin trash endpoint for managing soft-deleted records

---

*Architecture analysis: 2026-03-05*
