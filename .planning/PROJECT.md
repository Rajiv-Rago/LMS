# Kantigo

## What This Is

A self-serve AI learning platform where anyone can turn a topic into a structured course in seconds. Users enter a topic, AI generates a hybrid course mixing text lessons and curated YouTube videos, and learners progress through modules with quizzes. Courses improve over time through inline feedback that triggers instant LLM regeneration. A public catalog lets anyone browse and enroll without an account.

## Core Value

Anyone can turn a topic into a structured, high-quality learning path in seconds — and it gets better every time someone uses it.

## Requirements

### Validated

- User can sign up, log in, and manage sessions (JWT-based auth) — existing
- AI generates structured courses with modules, lessons, and quizzes from a topic — existing
- YouTube-based learning paths search and structure real videos into courses — existing
- Users can enroll in courses and progress through lessons — existing
- Quiz system with multiple question types, timer, and results — existing
- Multi-provider AI system (OpenAI, Anthropic, Gemini, Groq, Cerebras) with tier-based resolution — existing
- Markdown rendering for lesson content — existing
- Notification system (in-app via SSE) — existing
- File upload for project submissions — existing
- Dark/light mode toggle with system preference detection — v1.0
- Full visual polish (skeletons, typography, responsive, consistent spacing) — v1.0
- Learner-only role with ownership-based authorization — v1.0
- AI course generation accessible from dashboard in 2 clicks — v1.0
- Public course catalog browsable without authentication — v1.0
- Shareable course links with OG metadata — v1.0
- Post-auth auto-enrollment from catalog — v1.0
- Inline lesson feedback with instant LLM regeneration — v1.0
- Content versioning with revert capability — v1.0
- Rate-limited regeneration with credit tracking — v1.0
- Bug audit and stabilization of core flows — v1.0

### Active

(None yet — define in next milestone)

### Out of Scope

- Teacher role and manual course creation UI — simplified to AI-only generation for learners; admin retains manual creation
- Real-time collaboration — not needed for self-paced learning
- Mobile app — web-first
- Payment/subscription — free for now
- Social features (following, comments between users) — not the focus
- Component library migration (shadcn/ui, Radix) — existing components work
- Full theme customization (accent colors, fonts) — users want to learn, not design
- Animated page transitions — adds complexity, can feel sluggish
- External search service (Algolia) — MongoDB text index sufficient at current scale

## Context

Shipped v1.0 with 36,940 LOC TypeScript across 6 phases in 2 days.
Tech stack: Next.js 16, React 19, Tailwind CSS 4, MongoDB/Mongoose 8, JWT auth.
AI providers: OpenAI, Anthropic, Gemini, Groq, Cerebras with tier-based resolution.
YouTube integration via git submodule (packages/youtube-learning-path/).

Known issues (from pending todos):
- Duplicate course lists on dashboard could be merged into filterable single list
- Notifications dropdown has overflow issue
- Course generation error needs investigation
- Missing course delete/archive actions
- Course link routing goes to public page when authenticated

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Remove teacher role from UI | Target users are learners, not educators. AI generates all content. | Good — simplified UX significantly |
| Keep admin manual course creation | Admin needs escape hatch to create/edit courses directly | Good — preserved flexibility |
| Inline feedback with instant LLM fix | Courses improve as learners use them — core differentiator | Good — clean implementation with versioning |
| Public catalog + shareable links | Discovery and sharing drive growth without marketing | Good — three-tier access control works well |
| Ownership-based authorization over role-based | Eliminates role complexity, any user can own courses | Good — centralized via getCoursePermissions |
| Enrollment collection over enrolledStudents array | Atomic operations, proper indexing, scalable | Good — eliminated TOCTOU race conditions |
| Three-way theme (dark/light/system) | Respects user preference while allowing override | Good — clean implementation |
| Skeleton loading over spinners | Better perceived performance, professional feel | Good — consistent across all pages |

## Constraints

- **Tech stack**: Next.js 16, React 19, Tailwind CSS 4, MongoDB/Mongoose — established, no migration
- **AI providers**: Must keep multi-provider support (OpenAI, Anthropic, Gemini, Groq, Cerebras)
- **Branding**: Indigo-600 primary, existing color scheme maintained
- **Auth**: JWT-based httpOnly cookies — keep existing pattern

---
*Last updated: 2026-03-07 after v1.0 milestone*
