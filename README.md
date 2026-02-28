# YouTube Learning Path Builder

AI-powered web app that creates structured learning curriculums from YouTube videos. Describe what you want to learn, and the app searches YouTube, curates the best videos using an LLM, and organizes them into a progressive curriculum with progress tracking.

## Features

- **AI Curriculum Generation** — Multi-step form captures your topic, skill level, goals, and preferences. The app searches YouTube for relevant videos, then an LLM organizes them into a structured learning path with 2-4 modules.
- **Path Variants** — Each path comes in three flavors: Fast Track (essentials only), Standard (full path), and Deep Dive (extended with advanced topics).
- **Progress Tracking** — Mark videos as watched/watching/skipped, take notes with timestamps, track module checklists, and complete practice projects.
- **Study Schedule** — Week-by-week breakdown of videos to watch, matched to your time commitment.
- **Multiple Paths** — Create and switch between multiple concurrent learning paths.
- **Practice Projects** — AI-suggested projects per module with difficulty ratings and time estimates.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS (YouTube-inspired dark theme)
- **AI**: Groq API (llama-3.3-70b-versatile)
- **Video Data**: YouTube Data API v3
- **Storage**: Browser localStorage (migrating to MongoDB — see docs)

## Getting Started

### Prerequisites

- Node.js 18+
- A [YouTube Data API key](https://console.cloud.google.com/apis/credentials)
- A [Groq API key](https://console.groq.com/keys)

### Setup

```bash
# Install dependencies
npm install

# Copy environment template and fill in your keys
cp .env.local.example .env.local
```

Edit `.env.local` and set:

```
YOUTUBE_API_KEY=your_youtube_api_key
GROQ_API_KEY=your_groq_api_key
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/
    page.tsx              # Home — path creation form
    path/page.tsx         # Learning path display & tracking
    api/generate/route.ts # YouTube search + AI path generation
  components/
    form/                 # Multi-step form components
    path/                 # Path display components (modules, videos, roadmap)
    ui/                   # Shared UI primitives
  context/
    PathContext.tsx        # Global state management
  lib/
    youtube.ts            # YouTube Data API client
    groq.ts               # Groq LLM integration
    types.ts              # TypeScript interfaces
    storage.ts            # localStorage persistence
```

## Documentation

Production specs are in [`docs/`](./docs/):

| Doc | Contents |
|-----|----------|
| [00-overview](docs/00-overview.md) | Architecture, tech decisions, project structure |
| [01-database](docs/01-database.md) | MongoDB collections, schemas, indexes |
| [02-authentication](docs/02-authentication.md) | NextAuth.js setup, OAuth, session handling |
| [03-pricing-billing](docs/03-pricing-billing.md) | Stripe integration, Free/Pro/Team tiers |
| [04-security](docs/04-security.md) | Rate limiting, input validation, headers, encryption |
| [05-api-design](docs/05-api-design.md) | All API routes with request/response contracts |
| [06-migration-plan](docs/06-migration-plan.md) | localStorage to MongoDB migration |
| [07-deployment](docs/07-deployment.md) | Vercel config, CI/CD, monitoring |
| [08-task-delegation](docs/08-task-delegation.md) | Task breakdown for 3 developers |
| [09-future-plans](docs/09-future-plans.md) | Path sharing, community, exports |

## Scripts

```bash
npm run dev    # Start development server
npm run build  # Production build
npm run start  # Start production server
npm run lint   # Run ESLint
```

## License

Private — not open source.
