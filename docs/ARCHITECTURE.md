# Architecture (SUPERSEDED)

> **This document is outdated.** It was written for the initial MVP and references OpenAI/GPT-4, which has since been replaced with Groq. See `docs/00-overview.md` for the current architecture.

---

# Original Architecture (for reference only)

## Directory Structure

```
youtube-learning-path/
├── docs/                    # Project documentation
│   ├── PROJECT_SPEC.md      # Full feature specification
│   └── ARCHITECTURE.md      # This file
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── layout.tsx       # Root layout (fonts, theme)
│   │   ├── page.tsx         # Home / form page
│   │   ├── globals.css      # Global styles + Tailwind
│   │   └── path/
│   │       └── page.tsx     # Learning path results page
│   ├── components/          # React components
│   │   ├── form/            # Form step components
│   │   │   ├── TopicStep.tsx
│   │   │   ├── PreferencesStep.tsx
│   │   │   ├── TimeStep.tsx
│   │   │   ├── FiltersStep.tsx
│   │   │   └── FormProgress.tsx
│   │   ├── path/            # Learning path display
│   │   │   ├── PathSummary.tsx
│   │   │   ├── Roadmap.tsx
│   │   │   ├── ModuleCard.tsx
│   │   │   ├── VideoCard.tsx
│   │   │   ├── ProgressTracker.tsx
│   │   │   ├── StudySchedule.tsx
│   │   │   ├── PracticeProjects.tsx
│   │   │   ├── NotesPanel.tsx
│   │   │   └── AlternativePaths.tsx
│   │   └── ui/              # Shared UI primitives
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       ├── Checkbox.tsx
│   │       ├── Textarea.tsx
│   │       ├── ProgressBar.tsx
│   │       └── Modal.tsx
│   ├── lib/                 # Core logic
│   │   ├── youtube.ts       # YouTube Data API client
│   │   ├── openai.ts        # OpenAI GPT-4 curriculum builder
│   │   ├── types.ts         # TypeScript interfaces
│   │   └── storage.ts       # localStorage persistence
│   └── context/
│       └── PathContext.tsx   # Global state for learning paths
├── public/                  # Static assets
├── .env.local.example       # Environment variable template
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Data Flow

```
User Form Input
      │
      ▼
API Route: /api/generate
      │
      ├──► YouTube Data API v3
      │    - Search videos by topic + filters
      │    - Fetch video details (stats, duration)
      │    - Return top 50-100 results
      │
      ▼
Combine: user prefs + video data
      │
      ▼
OpenAI GPT-4 API
      │
      ├──► Structured curriculum JSON
      │    - Modules with ordered videos
      │    - Per-video justifications
      │    - Practice projects
      │    - Time estimates
      │    - Alternative paths
      │
      ▼
Client receives path → renders UI
      │
      ▼
localStorage persists progress
```

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/generate` | POST | Main endpoint: YouTube search + AI curation |
| `/api/alternative` | POST | Find alternative video for a specific topic |

## State Management

All state lives in `PathContext` and is persisted to `localStorage`:
- Current form inputs
- Generated learning paths (keyed by ID)
- Per-video progress (watched, skipped, notes)
- Streak data
- User preferences

## Key Decisions

1. **Next.js App Router** - Server components for initial load, client components for interactivity
2. **API routes for secrets** - YouTube and OpenAI keys never exposed to client
3. **localStorage** - No backend database needed for MVP; all data client-side
4. **Tailwind** - Rapid styling matching YouTube's design language
5. **Streaming** - GPT-4 response streamed to show progress during generation
