# LMS — Learning Management System

A full-stack learning management system with AI-powered content generation. Teachers create courses with modules, lessons, and assignments; students enroll, submit work, and take quizzes. AI features automate syllabus generation, lesson content creation, and provide an in-course AI tutor chatbot.

## Features

- **Course Management** — hierarchical course structure (courses → modules → lessons) with publish controls
- **AI Syllabus Generation** — generate full course structure from a text prompt
- **AI Lesson Content** — generate individual or bulk lesson content with one click
- **AI Tutor** — floating course chat that preserves conversations across pages, uses current saved page context, and hides during quiz attempts
- **Lesson Improvements** — title menu for feedback and video/text replacement, with Undo after regeneration
- **Keep Learning** — free recommendations and numbered citations in one section, with superscript citation links; refresh aims for five resources and costs one AI credit
- **Quizzes** — timed quizzes with auto-grading, multiple attempts, and score tracking
- **Lab Projects** — file-upload assignments with multi-file support
- **Gradebook** — teacher gradebook with per-student submission views
- **Roles** — student, teacher, and admin roles with full RBAC
- **Dark Mode** — system-aware theme with manual toggle
- **Notifications** — real-time notification bell with polling

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Database | MongoDB with Mongoose 8 |
| Auth | Auth.js credentials/OAuth sessions + bcryptjs |
| Validation | Zod 4 |
| AI Providers | OpenAI, Anthropic, Google Gemini, Groq, Cerebras |
| Testing | Jest 30, MongoDB Memory Server |
| Language | TypeScript 5 (strict mode) |

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas) — or use Docker (see below)

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd lms

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env — set MONGODB_URI, AUTH_SECRET, and at least one AI provider key

# Seed demo data (optional)
npm run seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | password123 |
| Teacher | teacher@demo.com | password123 |
| Student | student@demo.com | password123 |

## Docker

```bash
docker compose up -d --build app
```

The app container uses `MONGODB_URI` and `AUTH_SECRET` from `.env` at runtime. Set `MONGODB_URI` to a database the container can reach.

Compose sets `AUTH_TRUST_HOST=true`, as required by Auth.js for Docker deployments. After changing the Compose environment, run `docker compose up -d app` to recreate the container.

## Environment Variables

See [`.env.example`](.env.example) for all options. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `AUTH_SECRET` | Yes | Auth.js session secret (min 32 chars); signs credentials login, `/api/auth/me`, and OAuth link intents |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | No | Google OAuth credentials |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | No | GitHub OAuth credentials |
| `AUTH_FACEBOOK_ID` / `AUTH_FACEBOOK_SECRET` | No | Facebook OAuth credentials |
| `AI_PROVIDER` | No | Default AI provider (`openai`, `anthropic`, `cerebras`, `gemini`, `openrouter`) |
| `AI_MODEL` | No | Default model ID; blank uses the provider default |
| `OPENAI_API_KEY` | No* | OpenAI API key |
| `ANTHROPIC_API_KEY` | No* | Anthropic API key |
| `GROQ_API_KEY` | No* | Groq API key |
| `CEREBRAS_API_KEY` | No* | Cerebras API key |
| `GEMINI_API_KEY` | No* | Google Gemini API key |
| `OPENROUTER_API_KEY` | No* | OpenRouter API key; defaults to `openrouter/free` |
| `LANGSMITH_TRACING` | No | Set `true` to trace LangChain AI calls to LangSmith; disabled by default |
| `LANGSMITH_API_KEY` | No | Required only when tracing is enabled |
| `LANGSMITH_PROJECT` | No | Trace project name (for example, `kantigo`) |
| `LANGSMITH_ENDPOINT` | No | Region-specific API endpoint when the LangSmith workspace is outside the US |
| `LANGCHAIN_CALLBACKS_BACKGROUND` | No | Set `false` in Vercel/serverless deployments so traces finish before execution ends |
| `BRAVE_SEARCH_API_KEY` | No | Brave Search API key for reliable server-side course reference search; without it, DuckDuckGo HTML search is best effort |
| `STORAGE_PROVIDER` | No | `local` (default) or `s3` |
| `EMAIL_PROVIDER` | No | `console` (default), `resend`, `sendgrid`, or `ses` |
| `APP_URL` | No | Public URL for email links (default: `http://localhost:3000`) |

\* At least one AI provider key is required for AI features.

LangSmith tracing captures prompts, course context, and model responses. Enable it only after configuring the key and checking your data retention and disclosure settings. The app uses LangChain chat models for OpenAI, Anthropic, Cerebras, Gemini, and OpenRouter; the existing provider selection and response format remain the same.

### Model selection

Set your default in **Settings → AI Preferences → Advanced**, or select a provider and model on the course creation, content generation, or tutor screen. Resolution follows this order: explicit request provider/model, request tier, saved course preferences, user preferences, `AI_PROVIDER`/`AI_MODEL`, then OpenAI. New AI courses save the resolved provider and model for later lesson generation. Diagnostics use the environment default.

The model list lives in `lib/ai/utils/modelRegistry.ts`; tier priorities live in `lib/ai/utils/tierCatalog.ts`. There are no separate environment settings for syllabus, lesson, quiz, and tutor models.

For OpenRouter testing, add `OPENROUTER_API_KEY` to `.env`, then choose **OpenRouter → OpenRouter Free Router** in Advanced. It is available for explicit selection and is excluded from automatic tier selection. To use OpenRouter as the environment default:

```dotenv
AI_PROVIDER=openrouter
AI_MODEL=openrouter/free
```

An explicit OpenRouter model ID can replace `openrouter/free` in `AI_MODEL` or an API request. The free router can select different underlying models between requests. See [OpenRouter's free router documentation](https://openrouter.ai/docs/guides/routing/routers/free-router). Rebuild Docker after code changes with `docker compose up -d --build app`; recreate the container after environment changes with `docker compose up -d --force-recreate app`.

### Course web research

When a syllabus is generated, the server searches for up to five sources and reads up to three public HTML pages. It saves URLs and short page excerpts in `Course.references`; lesson generation receives the most relevant references as optional context. A source being read does **not** mean its claims were verified. Search failure leaves references empty and does not block course creation.

Set `BRAVE_SEARCH_API_KEY` in the Vercel project environment for a reliable indexed search backend. The no-key DuckDuckGo HTML fallback may be blocked or change without notice. The code in `packages/web-search` is a separate LM Studio plugin and is not invoked by Kantigo. Neither the search key nor arbitrary page-fetch URLs are exposed to the browser.

## Scripts

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Start production server
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage
npm run lint             # Run ESLint
npm run seed             # Seed demo data
npm run migrate          # Run database migrations
```

## Project Structure

```
app/
  (auth)/              # Login, register, password reset pages
  (dashboard)/         # Authenticated pages with sidebar layout
  api/                 # API route handlers
components/            # Reusable UI components
lib/
  ai/                  # AI providers, services, tier system
  auth/                # Auth.js callbacks, middleware, course ownership
  models/              # Mongoose schemas
  hooks/               # React hooks
  validation/          # Zod schemas
scripts/               # Seed, migrations
__tests__/             # Integration tests
```

## License

MIT
