# Architecture Patterns

**Domain:** AI learning platform UX improvements
**Researched:** 2026-03-06

## Current Architecture (Relevant to UX Polish)

The existing architecture is sound for this milestone. No structural changes needed.

### Component Boundaries (UX-relevant)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `app/globals.css` | Global styles, dark mode config, theme tokens | All components via CSS variables |
| `app/layout.tsx` | Root layout, FOUC script, font loading | All pages |
| `app/(dashboard)/layout.tsx` | Sidebar, dark mode toggle, auth check | All dashboard pages |
| `app/(auth)/layout.tsx` | Auth page layout (login, register) | Auth pages only |
| `components/ui/MarkdownContent.tsx` | Markdown rendering with prose styling | Lesson pages, any content display |
| `components/ui/Toast.tsx` | Toast notifications | Any page via `useToast()` |
| `components/ui/Skeleton.tsx` | Loading skeletons | Any page |
| `components/ai/ModelSelector.tsx` | AI tier/provider selection | Lesson gen, settings, course gen |

### Data Flow for Inline Feedback (Existing)

```
User writes feedback in textarea
  -> handleGenerate(feedback) called
  -> POST /api/courses/ai/[courseId]/lessons/[lessonId]/generate { feedback, tier/provider }
  -> Job created in queue
  -> Client polls GET /api/jobs/[jobId] every 2s
  -> Job handler calls LessonContentGeneratorService with feedback + previousContent
  -> LLM regenerates full lesson content
  -> Job completes, client fetches updated lesson
```

This flow works but has UX issues:
1. Full-page regeneration for any feedback (no section targeting)
2. User sees a generic skeleton during regeneration (no progress indication)
3. Feedback textarea is hidden behind an accordion ("Improve with AI" collapsible)

## Patterns to Follow

### Pattern 1: CSS-First Dark Mode (Tailwind CSS 4)

**What:** Use `@custom-variant dark` in CSS to enable class-based dark mode, keep the existing `.dark` class toggle on `<html>`.

**When:** Always. This is the fix for the broken dark mode.

**Example:**
```css
/* globals.css */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

**Why this pattern:** Tailwind CSS 4 moved from JavaScript config (`darkMode: 'class'` in v3's `tailwind.config.js`) to CSS-first config. The `@custom-variant` directive is the v4 equivalent. The codebase already has all the infrastructure (toggle hook, FOUC script, `dark:` classes) -- only the CSS directive is missing.

### Pattern 2: Optimistic Feedback UI

**What:** When user submits feedback for regeneration, immediately show a visual state change (dim current content, show "Regenerating with your feedback..." overlay) before the job starts.

**When:** Any async action where the user expects immediate acknowledgment.

**Example:**
```typescript
// Use React 19's useOptimistic for immediate UI feedback
const [optimisticLesson, setOptimisticLesson] = useOptimistic(lesson);

const handleRegenerate = async (feedback: string) => {
  setOptimisticLesson({ ...lesson, generationStatus: 'generating' });
  // Then fire the actual API call
};
```

### Pattern 3: Server-Side Catalog with Client-Side Enrichment

**What:** Render the course catalog as a server component for SEO and fast initial load, with client-side search/filter for interactivity.

**When:** Public-facing pages that benefit from SEO (catalog, shared course pages).

**Example approach:**
```
/catalog (server component)
  -> Fetches courses from MongoDB with pagination
  -> Renders course cards with title, description, topic
  -> Client component for search input + filter controls
  -> URL-based state via searchParams for shareable filtered views
```

### Pattern 4: Inline Toast Feedback for Actions

**What:** Use the existing toast system to confirm user actions (enrolled, feedback submitted, course shared).

**When:** Any user action that doesn't navigate to a new page.

**Example:** Already in codebase -- `toast.success("AI preferences saved")` in settings page.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Global State for Theme

**What:** Using React Context or a state management library for dark mode state.
**Why bad:** Theme must be available before React hydrates (to prevent FOUC). The existing inline `<script>` in `<head>` + `localStorage` + CSS class pattern is correct. Moving this into React state causes a flash of wrong theme on page load.
**Instead:** Keep the current pattern: inline script reads `localStorage` and sets `.dark` class before paint. React's `useDarkMode` hook syncs state for the toggle button UI only.

### Anti-Pattern 2: Dynamic Class Generation for Dark Mode

**What:** Building className strings dynamically based on a `dark` boolean: `className={dark ? 'bg-zinc-900' : 'bg-white'}`.
**Why bad:** Tailwind CSS uses static analysis to find utility classes. Dynamic construction can cause classes to be purged. Also duplicates logic that `dark:` variant handles automatically.
**Instead:** Always use `dark:` variant: `className="bg-white dark:bg-zinc-900"`.

### Anti-Pattern 3: Full-Page Loading States During Regeneration

**What:** Showing a full-page spinner or skeleton when only one lesson section is being regenerated.
**Why bad:** User loses context, can't see what changed, feels slow.
**Instead:** Show an inline indicator on the content being regenerated. Keep the rest of the page interactive.

### Anti-Pattern 4: Separate API for Public vs. Private Course Lists

**What:** Creating `/api/courses/public` separate from `/api/courses`.
**Why bad:** Duplicates query logic, leads to drift.
**Instead:** Add a `visibility` query parameter to the existing courses API. Public requests skip auth, private requests require auth. Same handler, different filters.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Course search | MongoDB text index, no caching | Add MongoDB Atlas Search (full-text) | External search service (Meilisearch) |
| Dark mode | CSS classes, no performance concern | Same | Same |
| Lesson regeneration | Direct job queue, poll every 2s | SSE for job status (replace polling) | Dedicated worker service, WebSocket |
| Course catalog | Simple paginated query | Add Redis cache for popular queries | CDN-cached catalog pages |
| Feedback aggregation | Store per-lesson | Aggregate feedback patterns | ML-driven quality scoring |

## Sources

- Tailwind CSS 4 `@custom-variant` docs: https://tailwindcss.com/docs/dark-mode (HIGH confidence)
- Tailwind CSS 4 `@theme` directive: https://tailwindcss.com/docs/theme (HIGH confidence)
- Codebase analysis of existing patterns (HIGH confidence, direct inspection)
