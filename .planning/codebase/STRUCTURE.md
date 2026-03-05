# Codebase Structure

**Analysis Date:** 2026-03-05

## Directory Layout

```
LMS/
├── app/                        # Next.js App Router pages and API routes
│   ├── layout.tsx              # Root layout (fonts, ToastProvider, ConfirmProvider)
│   ├── page.tsx                # Landing/marketing page
│   ├── globals.css             # Global Tailwind CSS styles
│   ├── (auth)/                 # Auth route group (unauthenticated, no sidebar)
│   │   ├── layout.tsx          # Centered card layout
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (dashboard)/            # Dashboard route group (authenticated, with sidebar)
│   │   ├── layout.tsx          # Sidebar + auth check + dark mode
│   │   ├── dashboard/page.tsx  # Main dashboard
│   │   ├── courses/            # Course listing and detail pages
│   │   ├── profile/page.tsx
│   │   └── settings/page.tsx
│   └── api/                    # API route handlers
│       ├── admin/              # Admin endpoints (trash management)
│       ├── ai/                 # AI chat, config, generation
│       ├── auth/               # Login, register, logout, password reset, sessions
│       ├── axiom/              # Axiom log proxy
│       ├── courses/            # Course CRUD, modules, lessons, assignments, submissions
│       ├── files/              # File serving
│       ├── health/             # Health check
│       ├── jobs/               # Job status polling
│       ├── notifications/      # Notification CRUD + SSE stream
│       ├── users/              # User profile, preferences, data export/deletion
│       └── youtube/            # YouTube search
├── components/                 # Reusable React components
│   ├── ai/                     # AI feature components
│   ├── course/                 # Course-specific components
│   ├── lesson/                 # Lesson display components
│   ├── project/                # Project submission components
│   ├── quiz/                   # Quiz components
│   └── ui/                     # Shared UI primitives
├── lib/                        # Shared server/client library code
│   ├── ai/                     # AI provider system
│   │   ├── providers/          # LLM provider implementations
│   │   ├── services/           # High-level AI services
│   │   └── utils/              # Provider resolution, tier catalog, JSON parsing
│   ├── auth/                   # Authentication utilities
│   ├── email/                  # Email sending system
│   │   └── providers/          # Email provider implementations
│   ├── hooks/                  # React client hooks
│   ├── models/                 # Mongoose model definitions
│   ├── queue/                  # Job queue system
│   │   └── handlers/           # Job type handlers
│   ├── storage/                # File storage abstraction
│   ├── utils/                  # General utilities
│   ├── validation/             # Zod validation schemas
│   └── youtube/                # YouTube integration service
├── packages/                   # External packages (git submodules)
│   └── youtube-learning-path/  # YouTube learning path generator (submodule)
│       └── src/core/           # Only this directory is imported by Kantigo
├── __tests__/                  # Test files
│   ├── helpers/                # Test utilities
│   ├── integration/            # Integration tests
│   │   ├── assignments/
│   │   ├── auth/
│   │   └── courses/
│   └── mocks/                  # Mock data and utilities
├── scripts/                    # Utility scripts
│   ├── seed.ts                 # Database seeding
│   ├── migrate.ts              # Migration runner
│   └── migrations/             # Database migrations
├── public/                     # Static assets (SVGs)
├── .github/workflows/          # CI pipeline (ci.yml)
├── middleware.ts               # Edge middleware (rate limiting, auth redirect, security headers)
├── instrumentation.ts          # Next.js instrumentation (starts queue worker)
├── next.config.ts              # Next.js config (Turbopack alias for @youtube-core)
├── tsconfig.json               # TypeScript config (path aliases, strict mode)
├── jest.config.ts              # Jest configuration
├── jest.setup.ts               # Jest global setup
├── eslint.config.mjs           # ESLint config
├── postcss.config.mjs          # PostCSS config (Tailwind)
├── Dockerfile                  # Docker build
├── docker-compose.yml          # Docker compose (app + MongoDB)
├── Makefile                    # Convenience targets
├── package.json                # Dependencies and scripts
└── .env.example                # Environment variable template
```

## Directory Purposes

**`app/`:**
- Purpose: Next.js App Router -- all pages and API routes
- Contains: Route groups `(auth)` and `(dashboard)`, `api/` route handlers, root layout/page
- Key files: `app/layout.tsx` (root), `app/(dashboard)/layout.tsx` (sidebar), `app/page.tsx` (landing)

**`app/api/`:**
- Purpose: REST API endpoints
- Contains: ~50 route handler files, each exporting named HTTP method functions
- Key conventions: Nested dynamic routes like `app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/route.ts`

**`components/`:**
- Purpose: Reusable React UI components organized by feature domain
- Contains: Client components (`"use client"`) for interactive UI
- Key files:
  - `components/ui/Toast.tsx` -- toast notification provider
  - `components/ui/ConfirmDialog.tsx` -- confirmation dialog provider
  - `components/ui/MarkdownContent.tsx` -- markdown rendering
  - `components/ui/NotificationBell.tsx` -- notification indicator with SSE
  - `components/ui/Skeleton.tsx` -- loading skeletons
  - `components/quiz/QuestionBuilder.tsx` -- quiz question editor
  - `components/quiz/QuestionCard.tsx` -- quiz question display
  - `components/quiz/QuizTimer.tsx` -- countdown timer
  - `components/quiz/QuizResults.tsx` -- quiz results display
  - `components/project/FileUploader.tsx` -- file upload component
  - `components/project/FileList.tsx` -- uploaded files list
  - `components/project/InstructionsViewer.tsx` -- project instructions
  - `components/ai/ModelSelector.tsx` -- AI model/tier selector
  - `components/ai/StatusBadge.tsx` -- generation status indicator
  - `components/lesson/ContentGenerationSkeleton.tsx` -- generation loading state
  - `components/lesson/YouTubeVideoPicker.tsx` -- YouTube video selection
  - `components/course/ShareDialog.tsx` -- course sharing dialog

**`lib/`:**
- Purpose: Shared library code used by both API routes and client components
- Contains: Server utilities, data models, service layers, hooks

**`lib/ai/`:**
- Purpose: Multi-provider AI system with services and resolution logic
- Contains: Provider interface, 5 provider implementations, 4 services, utility functions
- Key files:
  - `lib/ai/types.ts` -- AIProvider interface, types
  - `lib/ai/index.ts` -- factory function `createAIProvider()`, barrel exports
  - `lib/ai/providers/openai.ts`, `anthropic.ts`, `gemini.ts`, `groq.ts`, `cerebras.ts`
  - `lib/ai/services/syllabusGenerator.ts` -- course syllabus generation
  - `lib/ai/services/lessonContentGenerator.ts` -- lesson content generation
  - `lib/ai/services/tutor.ts` -- AI tutor chat
  - `lib/ai/services/generator.ts` -- general content generation
  - `lib/ai/utils/providerResolver.ts` -- 6-level provider resolution chain
  - `lib/ai/utils/tierCatalog.ts` -- tier-to-provider mapping (concise/balanced/thorough)
  - `lib/ai/utils/modelRegistry.ts` -- model metadata and display names
  - `lib/ai/utils/apiKeys.ts` -- env var name mapping for API keys
  - `lib/ai/utils/jsonParser.ts` -- AI response JSON extraction
  - `lib/ai/utils/userPreferences.ts` -- load user AI preferences from DB
  - `lib/ai/rateLimit.ts` -- daily AI usage rate limiting per subscription tier

**`lib/auth/`:**
- Purpose: Authentication, authorization, session management
- Key files:
  - `lib/auth/jwt.ts` -- JWT sign/verify/decode, JWTPayload type
  - `lib/auth/middleware.ts` -- requireAuth, requireRole HOFs, CSRF check, cookie management
  - `lib/auth/courseOwnership.ts` -- course ownership/access checks
  - `lib/auth/auditLog.ts` -- security event logging
  - `lib/auth/index.ts` -- barrel re-exports

**`lib/models/`:**
- Purpose: All Mongoose model definitions
- Contains: 14 models with TypeScript interfaces
- Key files:
  - `lib/models/User.ts` -- user with roles, subscription tiers, AI preferences, password hashing
  - `lib/models/Course.ts` -- course with instructor/owner, modules, enrollment, soft-delete
  - `lib/models/Module.ts` -- module with lessons, order, content generation status
  - `lib/models/Lesson.ts` -- lesson with content types (text/video/file), YouTube metadata, generation status
  - `lib/models/Assignment.ts` -- assignment types (standard/quiz/project), soft-delete
  - `lib/models/Submission.ts` -- submission with quiz attempts, file uploads, soft-delete
  - `lib/models/Job.ts` -- background job with status, attempts, retry support
  - `lib/models/Notification.ts` -- in-app notifications
  - `lib/models/AIChatSession.ts` -- AI tutor conversation sessions
  - `lib/models/AIGenerationLog.ts` -- AI generation audit trail
  - `lib/models/AIUsage.ts` -- daily AI usage counters per user/category
  - `lib/models/Session.ts` -- auth session records
  - `lib/models/AuditLog.ts` -- security audit events
  - `lib/models/Migration.ts` -- migration tracking
  - `lib/models/index.ts` -- barrel exports all models and types

**`lib/queue/`:**
- Purpose: Async job processing system
- Key files:
  - `lib/queue/index.ts` -- QueueAdapter interface, `enqueueJob()`, `getJobStatus()`
  - `lib/queue/mongoQueue.ts` -- MongoDB-backed adapter
  - `lib/queue/syncShim.ts` -- synchronous fallback (runs handler inline)
  - `lib/queue/worker.ts` -- polling worker (2s interval, max 2 concurrent)
  - `lib/queue/handlers/index.ts` -- handler registry + eager loading
  - `lib/queue/handlers/aiGeneration.ts` -- syllabus, module, lesson generation handlers
  - `lib/queue/handlers/youtubeGeneration.ts` -- YouTube path generation handler

**`lib/validation/`:**
- Purpose: Zod schemas for request validation
- Key files:
  - `lib/validation/authSchemas.ts` -- login, register, password reset schemas
  - `lib/validation/aiSchemas.ts` -- tier, provider, generation request schemas
  - `lib/validation/commonSchemas.ts` -- shared schemas (httpUrl)
  - `lib/validation/youtubeSchemas.ts` -- YouTube generation request schema

**`lib/hooks/`:**
- Purpose: Client-side React hooks
- Key files:
  - `lib/hooks/useJobPoller.ts` -- poll job status, invoke callbacks on complete/fail
  - `lib/hooks/useConfirm.ts` -- confirmation dialog hook
  - `lib/hooks/useToast.ts` -- toast notification hook
  - `lib/hooks/useUserAIDefaults.ts` -- fetch and cache user AI preferences

**`lib/storage/`:**
- Purpose: File storage abstraction
- Key files: `index.ts` (interface), `factory.ts` (provider factory), `local.ts`, `s3.ts`

**`lib/email/`:**
- Purpose: Email sending with pluggable providers
- Key files: `index.ts` (send), `types.ts`, `templates.ts`, `providers/` (console, sendgrid, ses, resend)

**`lib/youtube/`:**
- Purpose: YouTube learning path generation service
- Key files: `youtubePathService.ts`, `youtubePathPrompt.ts`, `types.ts`, `index.ts`

**`__tests__/`:**
- Purpose: Integration tests (separate from co-located unit tests)
- Contains: Integration tests by domain (auth, courses, assignments), helpers, mocks

**`scripts/`:**
- Purpose: Database utilities
- Key files: `seed.ts` (database seeding), `migrate.ts` (migration runner), `migrations/` (migration files)

**`packages/youtube-learning-path/`:**
- Purpose: Git submodule for YouTube search and video utilities
- Contains: Standalone app (excluded from compilation) + `src/core/` (imported by Kantigo)
- Key: Only `packages/youtube-learning-path/src/core/` is used; other directories are excluded via tsconfig

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root HTML layout, font loading, global providers
- `app/page.tsx`: Marketing landing page
- `app/(auth)/layout.tsx`: Centered card layout for auth pages
- `app/(dashboard)/layout.tsx`: Sidebar layout with auth check
- `middleware.ts`: Edge middleware (rate limiting, auth redirect, security headers)
- `instrumentation.ts`: Server startup hook (queue worker initialization)

**Configuration:**
- `next.config.ts`: Turbopack alias for `@youtube-core`
- `tsconfig.json`: Path aliases (`@/*` -> root, `@youtube-core/*` -> submodule core)
- `lib/env.ts`: Zod-validated environment variables
- `jest.config.ts`: Jest test runner config
- `eslint.config.mjs`: ESLint config
- `.env.example`: Environment variable template (reference only, never read contents)

**Core Logic:**
- `lib/ai/index.ts`: AI provider factory and exports
- `lib/ai/utils/providerResolver.ts`: AI provider resolution chain
- `lib/auth/middleware.ts`: Auth middleware (requireAuth, requireRole)
- `lib/queue/worker.ts`: Job queue worker
- `lib/queue/handlers/aiGeneration.ts`: AI generation job logic (~570 lines, largest handler)
- `lib/db.ts`: Database connection with caching and transactions

**Testing:**
- `__tests__/integration/`: Integration tests by domain
- `__tests__/helpers/`: Test utilities
- `__tests__/mocks/`: Mock data
- `lib/**/*.test.ts`: Co-located unit tests (e.g., `lib/ai/services/syllabusGenerator.test.ts`)

## Naming Conventions

**Files:**
- React pages: `page.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- React components: `PascalCase.tsx` (e.g., `QuestionBuilder.tsx`, `NotificationBell.tsx`)
- Mongoose models: `PascalCase.ts` (e.g., `Course.ts`, `AIChatSession.ts`)
- Services: `camelCase.ts` (e.g., `syllabusGenerator.ts`, `youtubePathService.ts`)
- Utilities: `camelCase.ts` (e.g., `providerResolver.ts`, `quizGrader.ts`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useJobPoller.ts`, `useToast.ts`)
- Tests: `*.test.ts` suffix co-located with source (e.g., `jwt.test.ts`)
- Barrel files: `index.ts` in most `lib/` subdirectories

**Directories:**
- Route groups: `(groupName)` (e.g., `(auth)`, `(dashboard)`)
- Dynamic segments: `[paramName]` (e.g., `[id]`, `[moduleId]`, `[sessionId]`)
- Catch-all: `[...path]` (e.g., `app/api/files/[...path]/`)
- Feature directories: lowercase singular or plural (e.g., `quiz/`, `models/`, `providers/`)

**Models:**
- Model names: PascalCase singular (e.g., `User`, `Course`, `AIGenerationLog`)
- Interface names: `I` prefix + model name (e.g., `IUser`, `ICourse`, `IJob`)
- Type exports: alongside interface (e.g., `SubmissionStatus`, `AssignmentType`)

## Where to Add New Code

**New API Endpoint:**
- Route handler: `app/api/{resource}/route.ts` or `app/api/{resource}/[id]/route.ts`
- Follow pattern: CSRF check -> authenticate -> validate with Zod -> dbConnect -> business logic -> NextResponse.json()
- If mutation needs auth: use `requireCsrf(request)` + `authenticate(request)` inline, or wrap with `requireAuth`/`requireRole` HOF
- Add Zod schema: inline in route file for simple schemas, or in `lib/validation/` for reusable schemas

**New Dashboard Page:**
- Page component: `app/(dashboard)/{feature}/page.tsx`
- Use `"use client"` directive for interactive pages
- Fetch data from API routes via `fetch()`

**New Mongoose Model:**
- Model file: `lib/models/{ModelName}.ts`
- Follow pattern: interface definition -> schema -> pre-hooks -> indexes -> `mongoose.models.X || mongoose.model()` export
- Add soft-delete if records should be recoverable (add `deletedAt` field + pre-find hook)
- Export from barrel: add to `lib/models/index.ts`

**New AI Provider:**
- Provider implementation: `lib/ai/providers/{name}.ts` implementing `AIProvider` interface
- Add to factory switch in `lib/ai/index.ts`
- Add API key mapping in `lib/ai/utils/apiKeys.ts`
- Add to provider lists in `lib/ai/utils/tierCatalog.ts`
- Add env var to `lib/env.ts` schema

**New AI Service:**
- Service file: `lib/ai/services/{serviceName}.ts`
- Accept `AIProviderConfig` in constructor, create provider via `createAIProvider()`
- Export from `lib/ai/services/index.ts`

**New Queue Job Type:**
- Handler: add `registerHandler("your.job-type", async (data) => {...})` in `lib/queue/handlers/`
- Import the handler file in `lib/queue/handlers/index.ts` (add to `handlersReady` Promise.all)
- Enqueue from API route: `enqueueJob({ type: "your.job-type", data, userId })`

**New React Component:**
- Feature-specific: `components/{feature}/{ComponentName}.tsx`
- Shared UI primitive: `components/ui/{ComponentName}.tsx`
- Use `"use client"` for interactive components

**New React Hook:**
- Hook file: `lib/hooks/use{HookName}.ts`
- Follow `use` prefix convention, return object with named values

**New Validation Schema:**
- Schema file: `lib/validation/{domain}Schemas.ts`
- Use Zod, export both schema and inferred type: `export type X = z.infer<typeof xSchema>`

**New Email Provider:**
- Provider: `lib/email/providers/{name}.ts` implementing `EmailProvider` interface
- Add case to `resolveProvider()` switch in `lib/email/index.ts`
- Add env var to `lib/env.ts`

**New Storage Provider:**
- Provider: `lib/storage/{name}.ts` implementing `FileStorage` interface
- Add case to `getStorage()` in `lib/storage/factory.ts`
- Add to `STORAGE_PROVIDER` enum in `lib/env.ts`

## Special Directories

**`packages/youtube-learning-path/`:**
- Purpose: Git submodule containing YouTube search/learning path utilities
- Generated: No (external dependency)
- Committed: Submodule reference committed, content lives in separate repo
- Import constraint: Only `src/core/` is imported; `src/app/`, `src/components/`, `src/context/`, `src/lib/` are excluded via tsconfig

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (by `npm run build` or `npm run dev`)
- Committed: No (gitignored)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (gitignored)

**`.planning/`:**
- Purpose: GSD planning documents for AI-assisted development
- Generated: Yes (by analysis agents)
- Committed: Varies (may be gitignored)

**`public/`:**
- Purpose: Static assets served at root path
- Contains: SVG icons (file.svg, globe.svg, next.svg, vercel.svg, window.svg)
- Generated: No
- Committed: Yes

**`scripts/migrations/`:**
- Purpose: Database migration files
- Generated: No (hand-written)
- Committed: Yes

---

*Structure analysis: 2026-03-05*
