# Kantigo

## What This Is

A self-serve AI learning platform for early graduates and developers who want to learn topics in a structured way but don't have time to organize articles, YouTube videos, and other sources. Users pick a topic, AI generates a structured course (lessons, YouTube videos, quizzes), and they learn through it. Courses improve over time through inline learner feedback that the LLM acts on.

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

### Active

- [ ] Fix dark/light mode toggle (exists but non-functional)
- [ ] Full visual polish (spacing, typography, responsive, consistency)
- [ ] Streamline core UX flows — reduce unnecessary steps, make navigation intuitive
- [ ] Add "Create Course" (AI generation) to dashboard — currently missing
- [ ] Simplify to learner-only role (remove teacher flows from UI, keep for admin)
- [ ] Public course catalog — all generated courses browsable by everyone
- [ ] Shareable course links — anyone can enroll via URL
- [ ] Inline lesson feedback — learner flags issues, LLM instantly regenerates that section
- [ ] Bug audit — find and fix unnoticed bugs across the platform

### Out of Scope

- Teacher role and manual course creation UI — simplified to AI-only generation for learners; admin retains manual creation
- Real-time collaboration — not needed for self-paced learning
- Mobile app — web-first
- Payment/subscription — free for now
- Social features (following, comments between users) — not the focus

## Context

Kantigo is a brownfield Next.js 16 app with a working AI course generation pipeline, YouTube integration, and quiz system. The current codebase has teacher/student role separation that needs simplifying. The UX has rough edges: broken dark mode, unintuitive flows, missing dashboard entry points for core features. The platform already supports multiple AI providers and a job queue for async generation.

Target users are early-career developers and graduates who want structured learning without spending hours curating resources.

## Constraints

- **Tech stack**: Next.js 16, React 19, Tailwind CSS 4, MongoDB/Mongoose — already established, no migration
- **AI providers**: Must keep multi-provider support (OpenAI, Anthropic, Gemini, Groq, Cerebras)
- **Branding**: Indigo-600 primary, existing color scheme maintained
- **Auth**: JWT-based httpOnly cookies — keep existing pattern

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Remove teacher role from UI | Target users are learners, not educators. AI generates all content. | — Pending |
| Keep admin manual course creation | Admin needs escape hatch to create/edit courses directly | — Pending |
| Inline feedback with instant LLM fix | Courses improve as learners use them — core differentiator | — Pending |
| Public catalog + shareable links | Discovery and sharing drive growth without marketing | — Pending |

---
*Last updated: 2026-03-06 after initialization*
