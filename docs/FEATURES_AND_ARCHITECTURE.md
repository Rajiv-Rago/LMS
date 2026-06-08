# Kantigo — Features & Architecture Reference

> A reference map of the entire application, written to anchor QA, testing, and eval work.
> For each system it notes **what it does**, **where it lives**, and **where quality is decided** —
> the last is the hook for content/video evals.
>
> Last mapped: 2026-05-23. Treat file paths/line numbers as a snapshot; verify before relying on them.

---

## 1. System Overview

Kantigo (kantigo.dev) is a full-stack LMS built on **Next.js 16 (App Router) + React 19 + Tailwind 4**, backed by **MongoDB/Mongoose 8**, with **JWT auth** and an **AI content-generation** layer over multiple LLM providers plus a **YouTube learning-path** generator.

Three actors: **student**, **teacher**, **admin**. A single `Course` is a flexible container that mixes manually-authored lessons, AI-generated lessons, and YouTube-video lessons — the content-type distinction lives at the lesson level, not the course level.

Two big "quality surfaces" that evals need to target:
1. **AI-generated educational content** — syllabi, lesson bodies, quizzes, summaries, practice, flashcards, tutor answers.
2. **YouTube-curated learning paths** — which videos get selected, how they're ordered, and why.

```
User (student | teacher | admin)
└── Course  (instructor + optional owner; enrolledStudents / Enrollment)
    ├── Module (order, contentStatus)
    │   └── Lesson (text | video | file; generationStatus; youtubeMetadata)
    ├── Assignment (standard | quiz | project)
    │   └── Submission (quizAttempts | files; grade/feedback)
    ├── AIGeneratedContent (quiz | summary | practice | flashcards; approvalStatus)
    └── AIChatSession (tutor conversations)
Cross-cutting: Enrollment, Session, Notification, AuditLog, AIGenerationLog, AIUsage, Job, Migration
```

---

## 2. Architecture

### Route groups & auth flow
- `app/(auth)/` — login, register, forgot-password, reset-password. No sidebar, unauthenticated.
- `app/(dashboard)/` — all authenticated pages; client-side auth gate via `GET /api/auth/me` in `app/(dashboard)/layout.tsx`, redirect to `/login` if unauthenticated. **Not middleware-based.**

### API route pattern
1. `authenticate(request)` → `JWTPayload` (`userId`, `email`, `role`, `subscriptionTier`).
2. `await dbConnect()` before DB ops (`lib/db.ts`, globally cached connection).
3. Validate body with Zod (`lib/validation/`).
4. Return `NextResponse.json()`.
- `requireAuth` / `requireRole` HOFs in `lib/auth/middleware.ts`.
- Next.js 16 async params: `const { id } = await params;`.
- Mutating routes require CSRF (`requireCsrf` — checks `x-requested-with: XMLHttpRequest`).

### Background jobs (`lib/queue/`)
- Adapter pattern, toggled by `QUEUE_ENABLED`: `MongoQueue` (persistent/async) vs `SyncShim` (in-process, synchronous — dev).
- Worker (`lib/queue/worker.ts`): 2s poll, max 2 concurrent, 5-min stale-job recovery, retries `[2s, 4s, 8s]`, default 3 attempts.
- Job types: `ai.generate-syllabus`, `ai.generate-module-content`, `ai.generate-lesson-content`, `ai.generate-youtube-path`.
- Status polled via `GET /api/jobs/[jobId]` (owner-scoped).

### Caching (`lib/cache.ts`)
- In-memory, 30s TTL. Keys: `courses:published:*`, `catalog:published:*`, `course:{id}`. Prefix invalidation on mutation.

### Observability
- `captureException(error, context)` → Axiom. Correlation IDs (`X-Correlation-ID`) threaded through AI ops.
- `AIGenerationLog` records every generation (provider, model, prompt, tokenUsage, status, durationMs).
- `AuditLog` records security events (90-day TTL).

---

## 3. Data Models (`lib/models/`)

| Model | Key fields | Notes for testing |
|---|---|---|
| **User** | email(unique), name, password(bcrypt, select:false), role, subscriptionTier, aiPreferences, failedLoginAttempts, lockUntil, deletedAt | `comparePassword()`, `isLocked()`; pre-save hash; soft-delete find hook |
| **Course** | title, description, instructor→User, owner→User?, sharedWith[], accessLevel(restricted/unlisted/published), enrolledCount, syllabusStatus, aiPreferences, youtubeMetadata, deletedAt | `enrolledStudents[]` deprecated → use Enrollment; virtual `isPublished` |
| **Module** | title, course→Course, lessons[], order, isPublished, contentStatus(skeleton/generating/completed/failed), generationConfig | status drives generation UI |
| **Lesson** | title, module→Module, contentType(text/video/file), content, videoUrl, duration, generationStatus, lessonOutline, keyTakeaways[], sources[{title,url}], previousContent, youtubeMetadata{videoId,channelName,viewCount,...} | revision tracking via previous* fields |
| **Assignment** | title, course, module?, dueDate, points(0-1000), assignmentType(standard/quiz/project), questions[], quizSettings{timeLimit,shuffleQuestions,showCorrectAnswers}, projectSettings, deletedAt | quiz `correctAnswer` index hidden from students at API layer |
| **Submission** | assignment, student, content/fileUrl/url, status(draft/submitted/graded/returned), grade, feedback, gradedBy, quizAttempts[], bestScore, files[] | unique (assignment, student) |
| **Enrollment** | course, student, enrolledAt | unique (course, student); `isEnrolled()`, `getEnrollmentCount()` statics |
| **Session** | userId, tokenHash, ip, userAgent, expiresAt | TTL auto-delete |
| **Notification** | userId, type, title, message, link, read, metadata | |
| **AuditLog** | userId, action(enum), resource, resourceId, ip, metadata | 90-day TTL |
| **AIGeneratedContent** | course, lesson?, generatedBy, contentType(quiz/summary/practice/flashcards), content, quizQuestions[], provider, approvalStatus(pending/approved/rejected), approvedBy | students see only `approved` |
| **AIChatSession** | user, course, lesson?, messages[{role,content,timestamp}], provider | |
| **AIGenerationLog** | user, course, module?, lesson?, generationType, provider, model, prompt, response, tokenUsage, status, durationMs | **primary data source for content evals** |
| **AIUsage** | user, category(questions/credits), dateKey(YYYY-MM-DD), count | unique per (user,category,day); 7-day TTL |
| **Job** | type, status, data, userId, attempts, maxAttempts, error, result | |
| **Migration** | name(unique), executedAt | |

---

## 4. Feature Catalog (API surface, ~48 routes)

### Auth (`app/api/auth/`)
- `POST /login` — lockout after 5 fails (15-min lock), session w/ IP+UA, audit log. 423 on locked.
- `POST /register` — auto student role, creates session.
- `POST /logout` — revokes session token hash.
- `POST /refresh` — token rotation, 1-hour expiry grace window.
- `GET /me` — current user + aiPreferences (drives dashboard auth gate).
- `POST /forgot-password`, `POST /reset-password` (forgot-password link currently hidden in UI).
- `GET/POST/DELETE /sessions` — multi-device session management.

### Courses (`app/api/courses/`)
- `GET /courses` — catalog vs my-courses vs enrolled; search; pagination; 30s cache. Authz-filtered per role.
- `POST /courses` — **admin only**.
- `GET/PATCH/DELETE /courses/[id]` — GET returns `permissions{canEdit,canEnroll,isEnrolled,isInstructor}`; DELETE is soft.
- `POST/DELETE /courses/[id]/enroll` — guards restricted courses, self-enroll by instructor, duplicates; notifies instructor.
- `GET/POST/DELETE /courses/[id]/share` — owner/instructor only; students capped at 5 shares.
- `GET /courses/[id]/gradebook` — instructor matrix (students × assignments).
- `GET /courses/[id]/grades` — student's own grades + summary.
- `POST /courses/generate` — enqueues `ai.generate-syllabus`; rate-limited; free tier capped at 5 generated courses. 202 + jobId.
- Modules: `GET/POST /courses/[id]/modules`, `GET/PATCH/DELETE .../[moduleId]` (cascade-deletes lessons in a txn).
- Lessons: `GET/POST .../lessons`, `GET/PATCH/DELETE .../[lessonId]` (PATCH handles youtubeMetadata, contentType transitions).

### Assignments & submissions
- `GET/POST /courses/[id]/assignments`, `GET/PATCH/DELETE .../[assignmentId]` (DELETE cascades submissions). Student GET of a quiz strips `correctAnswer`.
- `GET/POST .../submissions`, `GET/PATCH .../[submissionId]` (PATCH = grade; notifies student; only "submitted" gradable).
- Quiz: `POST .../quiz/start` (attempt tracking, time-limit auto-close, shuffle, remainingTime) and `POST .../quiz/submit` (auto-grade via `gradeQuiz()`, best-score across attempts).

### AI (`app/api/ai/`)
- `POST /ai/chat` — tutor; multi-turn `AIChatSession`; injects course/lesson context; rate-limited; correlation IDs. `tier` XOR `provider`.
- `GET /ai/chat/sessions`, `GET/POST /ai/chat/[sessionId]`.
- `POST /ai/generate` — synchronous quiz/summary/practice/flashcards → `AIGeneratedContent` (approvalStatus pending). `GET` lists (students: approved only).
- `GET /ai/credits` — remaining/limit/resetAt. `GET /ai/config`.

### YouTube (`app/api/`)
- `GET /youtube/search` — proxied search, maxResults 1-10. 503 if no API key.
- `POST /courses/youtube/generate` — enqueues `ai.generate-youtube-path`, 202 + jobId.

### Misc
- `GET/POST /notifications`, `GET/PATCH /notifications/[id]`, `GET /notifications/stream` (SSE).
- `GET/PATCH /users/preferences`, `GET /users/me/export`, `DELETE /users/me/delete`.
- `GET /health`, `GET /jobs/[jobId]`, `POST /files/[...path]`, `POST /axiom`, `POST /admin/trash`.

---

## 5. AI Subsystem (`lib/ai/`) — where content quality is decided

### Provider abstraction (`lib/ai/providers/`, `lib/ai/types.ts`)
`AIProvider` interface: `chat()`, optional `chatStream()`, `generateText()`.
- **OpenAI** (`gpt-4o-mini` default), **Anthropic** (`claude-3-haiku` default), **Cerebras** (OpenAI SDK + Cerebras baseURL), **Gemini** (`gemini-3.1-flash-lite`, supports Google Search grounding + streaming + source extraction).
- Resolution (`utils/providerResolver.ts`) priority: explicit provider+model → request tier → course prefs → user tier → user provider → env (`AI_PROVIDER`/`AI_MODEL`) → OpenAI fallback.
- Tier catalog (`utils/tierCatalog.ts`): concise / balanced / thorough, each with its own provider preference order. Model registry in `utils/modelRegistry.ts`.
- Errors (`errors.ts`): `AIProviderError` classifies transient (429/5xx/timeout/network) vs non-transient (401/403).

### Services (`lib/ai/services/`) — the quality-bearing prompts
- **SyllabusGeneratorService** — enforces 4-8 modules × 3-6 lessons, JSON-only, level-appropriate progression; for hybrid courses emits `videoSearchQuery` per video lesson. JSON validated structurally.
- **LessonContentGeneratorService** — markdown body + 3-5 `keyTakeaways` + 3-8 authoritative `sources`. Tier controls depth: concise 400-800w / balanced 800-1500w / thorough 1500-2500w. Supports streaming and feedback-driven regeneration; merges/dedups grounding sources.
- **AITutorService** — Socratic system prompt; injects course/lesson/aiContext; `chat()` and `askQuestion()`.
- **AIContentGenerator** — quiz (MCQ + explanations), summary, practice (problems + step solutions), flashcards (front/back). JSON-mode outputs.
- Shared JSON parsing in `utils/jsonParser.ts` (strips ```json fences, validates).

**Quality determination points (eval targets):**
| Surface | File | What "good" means |
|---|---|---|
| Syllabus structure | `services/syllabusGenerator.ts` | module/lesson counts, logical ordering, level fit, useful video queries |
| Lesson body | `services/lessonContentGenerator.ts` | accuracy, depth-matches-tier, valid markdown, real working source links, coherent with prior lessons |
| Quiz/practice/flashcards | `services/generator.ts` | correct answers, non-trivial distractors, explanations present, solvable problems |
| Tutor | `services/tutor.ts` | on-topic, pedagogically sound, doesn't just give answers, admits limits |

---

## 6. YouTube Subsystem (`lib/youtube/`, `packages/youtube-learning-path/src/core/`) — where video quality is decided

### Pipeline (`lib/youtube/youtubePathService.ts`)
1. **Search** — `searchYouTubeVideos(apiKey, {topic, maxResults:50, order:"relevance"})`. Core (`youtubeSearch.ts`) fans out 4 query variants: `"{topic} tutorial"`, `"learn {topic} beginner to advanced"`, `"{topic} full course"`, `"{topic} explained"`. Filters: `type=video`, `videoEmbeddable=true`, `relevanceLanguage=en`.
2. **Details** — `getVideoDetails()` batches (50/call) for snippet + contentDetails + statistics (view/like/comment counts, duration). **Only automatic filter: drop videos < 120s.**
3. **Dedup** — `filterAndDedup()`: dedup by `videoId` + re-applies the 120s floor. **No quality filtering** (no view/like-ratio/channel-authority thresholds, no per-channel cap).
4. **LLM curation** — `youtubePathPrompt.ts` hands the LLM the video list (title, 200-char description, viewCount, publishedAt, duration, channel) and asks it to "select best videos," group into ordered modules, give `whyIncluded` + 2-3 `keyTakeaways` per video, optionally add a practice project. `pathVariant` controls breadth (fast_track 3-4 modules / standard / deep_dive). **No system prompt; no post-generation validation.**
5. **Parse** — first JSON object extracted; requires `courseTitle` + non-empty `modules[]`.

Result is persisted by `lib/queue/handlers/youtubeGeneration.ts` as Course → Modules → video Lessons (with `youtubeMetadata`) → optional practice-project Assignments.

**Key gap for evals:** video relevance/quality is **entirely LLM-judged** from raw metadata, with no measurable criteria and no validation pass. Captured metadata (`viewCount`, `likeCount`, `commentCount`, `durationSeconds`, `publishedAt`, `channelName`) is the available signal for an objective scorer.

---

## 7. Frontend & User Flows

- **Auth pages**: login (supports `?enroll=[courseId]` redirect), register, forgot/reset password.
- **Dashboard** (`/dashboard`): quick AI-generate input + my courses.
- **Courses**: `/courses` (filter all/teaching/learning, search, delete), `/courses/new` (manual), `/courses/new/ai` (AI gen with ModelSelector + optional YouTube videos; polls job).
- **Content**: `/courses/[id]/overview`; module view; lesson view with markdown rendering, YouTube picker, streaming AI generation (AbortController cancel), undo-within-window, feedback section.
- **Assignments/Quiz**: list/create; submit (text/file/url); quiz timer, progress, results, unlimited retakes, best score.
- **AI**: `/courses/[id]/ai/generate`, `/ai/content` (history + approval), `/ai/tutor` (chat).
- **Grading**: teacher `gradebook`, student `grades`.
- **Components** (`components/`, ~26): `ui/` (Button, Markdown, Toast, ConfirmDialog, NotificationBell, ThemeToggle, BottomNav…), `quiz/`, `lesson/` (YouTubeVideoPicker, ContentGenerationSkeleton, FeedbackSection), `ai/` (ModelSelector, StatusBadge), `dashboard/`, `course/` (ShareDialog), `project/` (FileUploader, FileList, InstructionsViewer).

---

## 8. Current Test Coverage & Gaps

**Setup**: Jest 30, `jest-environment-node`, MongoDB Memory Server, fixtures (`__tests__/helpers/`), AI provider mock (`__tests__/mocks/aiProvider.ts`). Coverage threshold 30%.

**Covered (~39 test files)**: auth flows, course CRUD/authz/enrollment, assignment/submission, quiz mechanics, gradebook, AI service error handling, queue worker + aiGeneration, lesson feedback/revert, validation utils, models.

**Gaps:**
- ❌ **No frontend component/page tests** (zero `.test.tsx`) — dialogs, forms, markdown render, YouTube picker, streaming UI, notifications, mobile nav.
- ❌ **No E2E flows** (login → create → enroll → submit → grade).
- ❌ **No content-quality evals** — AI output correctness/pedagogy is unmeasured.
- ❌ **No YouTube-selection evals** — relevance/quality of curated videos unmeasured.
- ❌ File upload, SSE notification stream untested.

---

## 9. Recommended QA / Testing / Eval Roadmap

### A. Deterministic correctness (extend existing Jest suite)
- API contract tests for the ~10 untested routes (share, gradebook, grades, notifications, preferences, files, youtube/search, ai/generate GET filters, sessions).
- Component tests (React Testing Library): ModelSelector, QuizTimer/QuestionCard/QuizResults, YouTubeVideoPicker, MarkdownContent, ConfirmDialog.
- One E2E happy-path per role (Playwright): teacher authors course; student enrolls + submits quiz + sees grade.
- Quiz auto-grader property tests (shuffle, partial answers, time-expiry, best-score).

### B. AI content-quality evals (new harness)
Build an eval harness that runs generators against a fixed topic set and scores outputs. Two complementary scorers:
- **Deterministic checks** — JSON schema validity; module/lesson counts within bounds; word-count matches tier; quiz `correctAnswer` index in range and uniquely correct; sources are reachable URLs (HTTP 200); markdown parses; no empty sections.
- **LLM-as-judge rubric** — score 1-5 on: factual accuracy, level-appropriateness, pedagogical clarity, coherence with adjacent lessons, source quality. Use a stronger model than the one under test; log scores keyed to provider/model/tier so regressions per-config are visible.
- Wire to `AIGenerationLog` to backfill evals over real historical generations (it stores prompt, response, provider, model, tokenUsage).
- Track: pass rate, mean rubric score, hallucinated/broken-link rate, JSON-parse-failure rate, latency, token cost — segmented by provider/model/tier.

### C. YouTube video-quality evals (new harness)
The current pipeline has no measurable selection criteria — this is the biggest eval opportunity.
- **Objective signal scorer** (no LLM): from captured metadata, score each selected video on view count, like/view ratio, comment engagement, recency vs topic volatility, duration appropriateness for `pathVariant`, and channel diversity (penalize many videos from one channel — currently uncapped).
- **Relevance judge** (LLM-as-judge): given topic + skillLevel + video title/description, rate topical relevance and level fit 1-5; flag off-topic or mismatched-level picks.
- **Path coherence** check: modules ordered foundational→advanced; no large duration/level jumps; `whyIncluded`/`keyTakeaways` actually reference the video.
- **Embeddability/liveness** check: re-verify each `videoId` still resolves and `videoEmbeddable=true` at eval time (links rot).
- Consider feeding the objective scores back into the pipeline as a pre-LLM filter or as ranking hints in the prompt (currently the LLM gets no quality guidance).

### D. Eval infrastructure notes
- Curate a versioned **eval set** of ~20-30 topics spanning skill levels and domains; keep it in `__tests__/evals/` or `evals/` with golden expectations where deterministic.
- Run evals on a schedule / pre-release, not per-commit (cost + latency). Gate releases on deterministic checks; treat LLM-judge scores as trend metrics with alert thresholds.
- Always segment results by provider/model/tier — that's the axis along which quality and cost trade off here.

---

## 10. Quick reference — env & commands

```bash
npm run dev | build | start | test | lint
npm test -- path/to/file.test.ts
npm run test:watch | test:coverage
```
Env: `MONGODB_URI`, `JWT_SECRET` (required); `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GEMINI_API_KEY`/`GROQ_API_KEY`/`CEREBRAS_API_KEY` (≥1 for AI); `AI_PROVIDER`, `AI_MODEL`; `YOUTUBE_API_KEY`; `QUEUE_ENABLED`.
</content>
</invoke>
