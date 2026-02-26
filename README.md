# LMS — Learning Management System

A full-stack learning management system with AI-powered content generation. Teachers create courses with modules, lessons, and assignments; students enroll, submit work, and take quizzes. AI features automate syllabus generation, lesson content creation, and provide an in-course AI tutor chatbot.

## Features

- **Course Management** — hierarchical course structure (courses → modules → lessons) with publish controls
- **AI Syllabus Generation** — generate full course structure from a text prompt
- **AI Lesson Content** — generate individual or bulk lesson content with one click
- **AI Tutor** — per-course chat sessions with full context of course material
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
| Auth | JWT (httpOnly cookies) + bcryptjs |
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
# Edit .env — set MONGODB_URI, JWT_SECRET, and at least one AI provider key

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
# Start MongoDB only (for local development)
docker compose up -d mongo

# Start full stack (MongoDB + production app)
docker compose --profile prod up
```

## Environment Variables

See [`.env.example`](.env.example) for all options. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `AI_PROVIDER` | No | Default AI provider (`openai`, `anthropic`, `groq`, `cerebras`, `gemini`) |
| `OPENAI_API_KEY` | No* | OpenAI API key |
| `ANTHROPIC_API_KEY` | No* | Anthropic API key |
| `GROQ_API_KEY` | No* | Groq API key |
| `CEREBRAS_API_KEY` | No* | Cerebras API key |
| `GEMINI_API_KEY` | No* | Google Gemini API key |
| `STORAGE_PROVIDER` | No | `local` (default) or `s3` |
| `EMAIL_PROVIDER` | No | `console` (default), `resend`, `sendgrid`, or `ses` |
| `APP_URL` | No | Public URL for email links (default: `http://localhost:3000`) |

\* At least one AI provider key is required for AI features.

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
  auth/                # JWT, middleware, course ownership
  models/              # Mongoose schemas
  hooks/               # React hooks
  validation/          # Zod schemas
scripts/               # Seed, migrations
__tests__/             # Integration tests
```

## License

MIT
