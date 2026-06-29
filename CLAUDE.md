# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kantigo (kantigo.dev) — A fun, curious, inviting learning platform that turns any topic into a structured path. Full-stack web application with AI-powered content generation and curated YouTube courses. Teachers create courses with modules/lessons/assignments; students enroll, submit work, and take quizzes. AI features allow automated syllabus and lesson content generation via multiple LLM providers, plus YouTube-based learning path generation.

## Commands

```bash
npm run dev              # Start dev server at http://localhost:3000
npm run build            # Build for production
npm start                # Start production server
npm test                 # Run Jest tests
npm test -- path/to/file.test.ts   # Run a single test file
npm run test:watch       # Run Jest in watch mode
npm run test:coverage    # Run tests with coverage
npm run lint             # Run ESLint
```

## Environment Variables

Required in `.env`:
- `MONGODB_URI` - MongoDB connection string
- `AUTH_SECRET` - Auth.js session secret (min 32 chars), signs sessions/`me`/OAuth link intents

AI provider keys (at least one required for AI features):
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`
- `AI_PROVIDER` - Default provider name (defaults to "openai")
- `AI_MODEL` - Default model override (optional)

YouTube features:
- `YOUTUBE_API_KEY` - YouTube Data API v3 key (required for YouTube learning path generation)

## Architecture

### Route Groups & Auth Flow

The app uses two Next.js route groups:
- `app/(auth)/` - Login/register pages (no sidebar, unauthenticated)
- `app/(dashboard)/` - All authenticated pages with sidebar layout

Authentication is JWT-based via httpOnly cookies. The dashboard layout (`app/(dashboard)/layout.tsx`) fetches the user from `GET /api/auth/me` on mount and redirects to `/login` if unauthenticated. This is a client-side auth check, not middleware-based.

### API Route Patterns

API routes live under `app/api/` and follow Next.js Route Handlers. The standard pattern:

1. Call `authenticate(request)` to get the `JWTPayload` (userId, email, role)
2. Call `await dbConnect()` before any database operations
3. Validate request body with Zod schemas
4. Return `NextResponse.json()`

For routes requiring auth, use the `requireAuth` or `requireRole` HOF wrappers from `lib/auth/middleware.ts`. Route params in Next.js 16 are async: `const { id } = await params;`.

### Data Model Hierarchy

```
User (student | teacher | admin)
└── Course
    ├── Module
    │   └── Lesson (text | video | file) — video lessons may have youtubeMetadata
    ├── Assignment (standard | quiz | project)
    │   └── Submission
    └── AIChatSession (AI tutor conversations)
```

Courses are flexible containers — a single course can mix manually-created content, AI-generated lessons, and YouTube video lessons. Courses have an `instructor` (teacher who created it) and optionally an `owner` (for user-owned courses, e.g. self-generated learning paths). The `enrolledStudents` array tracks enrollment. There is no `courseType` field — the content type distinction lives at the lesson level.

### AI System (`lib/ai/`)

The AI subsystem uses a provider pattern with a common `AIProvider` interface:

- **Providers** (`lib/ai/providers/`): OpenAI, Anthropic, Gemini, Groq, Cerebras - each implements `chat()` and `generateText()`
- **Services** (`lib/ai/services/`): Higher-level services built on providers:
  - `SyllabusGeneratorService` - Generates course syllabi from prompts
  - `LessonContentGeneratorService` - Generates lesson content for modules
  - `AITutorService` - Powers the AI tutor chat
  - `AIContentGenerator` - General content generation
- **Provider resolution** (`lib/ai/utils/providerResolver.ts`): Resolves which provider to use with priority: request → course preferences → env vars → openai default

Use `createAIProvider(config)` to instantiate a provider. Validation for AI requests uses Zod schemas in `lib/validation/aiSchemas.ts`.

### YouTube System (`lib/youtube/`)

YouTube learning path generation uses a git submodule at `packages/youtube-learning-path/` (from [Rajiv-Rago/Youtube-Learning-Path](https://github.com/Rajiv-Rago/Youtube-Learning-Path)). Only the `src/core/` directory is imported by Kantigo — the submodule's standalone app code is excluded from compilation and linting.

- **Core imports** (`@youtube-core/*`): `searchYouTubeVideos()`, `getVideoDetails()`, `filterAndDedup()`, and related types
- **`YouTubePathService`** (`lib/youtube/youtubePathService.ts`): Orchestrates YouTube search → LLM curriculum structuring → parsed result
- **Job handler** (`lib/queue/handlers/youtubeGeneration.ts`): Handles `ai.generate-youtube-path` jobs — creates Course, Modules, Lessons (with `youtubeMetadata`), and Assignments
- **API route**: `POST /api/courses/youtube/generate` — enqueues a job and returns `{ jobId }` with 202 status

### Branding & Color Scheme

- **Primary**: `indigo-600` / `indigo-500`
- **AI gradient**: `from-indigo-600 to-violet-600`
- **YouTube gradient**: `from-red-600 to-indigo-600`
- **Success**: `emerald-500`
- **Highlights**: `amber-500`
- **Neutrals**: Zinc scale
- **Email hex**: `#4f46e5` (indigo-600)

### Key Conventions

- **Database connection**: Always use `dbConnect()` from `lib/db.ts` - it caches the connection globally
- **Models**: Use `mongoose.models.X || mongoose.model()` pattern to prevent recompilation
- **Path aliases**: `@/*` maps to project root, `@youtube-core/*` maps to `packages/youtube-learning-path/src/core/*`
- **Roles**: Three roles (`student`, `teacher`, `admin`) checked via `user.role` from JWT payload
- **Course ownership**: Use helpers from `lib/auth/courseOwnership.ts` (`checkCourseOwnership`, `canModifyOwnedCourse`, `canAccessOwnedCourse`) for authorization checks on courses. A course is "user-owned" if `course.owner` exists (no `courseType` field)

### Components

Reusable UI components live in `components/` organized by feature:
- `components/quiz/` - Quiz taking/building (QuestionBuilder, QuestionCard, QuizTimer, QuizResults)
- `components/project/` - Lab project submissions (FileUploader, FileList, InstructionsViewer)
- `components/ai/` - AI feature UI (ModelSelector, StatusBadge)

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React 19, Tailwind CSS 4
- **Database**: MongoDB with Mongoose 8
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Validation**: Zod 4
- **AI SDKs**: openai, @anthropic-ai/sdk, @google/generative-ai
- **Testing**: Jest 30
- **Language**: TypeScript 5 (strict mode)
