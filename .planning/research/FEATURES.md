# Feature Landscape

**Domain:** AI-powered learning platform UX polish
**Researched:** 2026-03-06

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Working dark/light mode toggle | Toggle exists in sidebar but dark mode is broken (CSS misconfiguration). Users see the button, click it, nothing visible happens. | Low | One CSS line fix (`@custom-variant dark`). All `dark:` classes already exist across the codebase. |
| Consistent dark mode across all pages | Auth pages, dashboard, course detail, lesson view -- all must respect the toggle. | Medium | Auth layout (`app/(auth)/layout.tsx`) needs dark mode classes added. Currently uses hardcoded light colors. |
| Course catalog / browse page | Users need to discover courses created by others. Currently no public browse. | Medium | New page + API route. MongoDB text index for search. Filter by topic, sort by date/popularity. |
| Dashboard "Create Course" entry point | AI course generation exists but is not accessible from the dashboard. Users have to navigate to `/courses/new`. | Low | Add prominent CTA button/card on the dashboard page. |
| Responsive design polish | Mobile sidebar exists but content pages have inconsistent padding/overflow. | Medium | Audit all dashboard pages for mobile breakpoints. Fix overflow on code blocks, tables in markdown. |
| Loading states that feel intentional | Some pages have loading spinners, some have skeleton screens, some show blank white. | Low | Standardize on skeleton screens using existing `Skeleton` components. |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Inline lesson feedback with instant regeneration | Learner flags issues, AI regenerates that section. Courses improve as people use them. Core differentiator per PROJECT.md. | Medium | Existing implementation has full-lesson regeneration with feedback textarea. Enhance to section-level: let users highlight/flag specific paragraphs. |
| Shareable course links with instant enrollment | Anyone can share a URL, recipient enrolls with one click. Viral growth without marketing. | Low | Generate shareable URLs, add enrollment endpoint that handles both authenticated and unauthenticated users (redirect to register then auto-enroll). |
| Course generation from dashboard in 2 clicks | "What do you want to learn?" -> topic input -> generate. Minimal friction. | Low | Streamline the existing multi-step flow. Combine topic + tier selection into a single compact form on the dashboard. |
| Smooth theme transitions | Dark mode toggle with smooth color transitions, not jarring instant swap. | Low | Add `transition-colors duration-200` to body and key containers. Pure CSS, no library. |
| System theme detection with manual override | Three-way toggle: light / dark / system. Respects OS preference by default but allows override. | Low | The FOUC script already handles this logic. Expose "system" as a third option in the UI (currently binary toggle). |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full theme customization (accent colors, fonts) | Scope creep. Users want to learn, not design. Branding decisions are product decisions, not user preferences. | Keep the indigo-600 palette. Allow dark/light only. |
| Real-time collaborative editing | Not a collaborative tool. Self-paced learning platform. | Keep single-user lesson viewing. |
| Complex search with filters/facets (Algolia-style) | Over-engineering for current scale. Hundreds of courses, not millions. | MongoDB text index with basic keyword search, category filter, sort by date. |
| Component library migration (shadcn/ui, Radix) | Introduces inconsistency mid-project. Existing components work and match the design system. | Polish existing components. Extract shared patterns if needed. |
| Notification preferences page | Users don't need granular notification controls for a learning platform. | Keep the existing SSE notification bell. Add toast feedback for actions. |
| Animated page transitions | Adds complexity and can feel sluggish. Learning platforms should feel snappy, not fancy. | Use skeleton loading states and fast navigation. |

## Feature Dependencies

```
@custom-variant dark (CSS fix) -> All dark mode features work
  -> Dark mode on auth pages
  -> Dark mode on course catalog
  -> Dark prose-invert in markdown
  -> Smooth theme transitions

Dashboard "Create Course" CTA -> Streamlined generation flow
  -> Quick topic input form
  -> Tier selection (existing ModelSelector)

Public course catalog page -> Course discovery
  -> MongoDB text index on courses
  -> Shareable course links
  -> Enrollment from catalog

Inline feedback (existing) -> Section-level feedback (enhancement)
  -> Paragraph-level flag/highlight
  -> Targeted regeneration API
```

## MVP Recommendation

Prioritize:
1. **Dark mode CSS fix** -- one line, fixes the most visible broken feature
2. **Dashboard "Create Course" entry point** -- makes the core value accessible
3. **Public course catalog** -- enables discovery and sharing
4. **Shareable course links** -- viral growth mechanism
5. **Inline feedback polish** -- improve existing implementation (already works at lesson level)

Defer:
- **Section-level feedback** (paragraph highlighting + targeted regeneration): Requires new API endpoints, content parsing, and UI for selecting sections. Do after the basic inline feedback is polished.
- **Semantic color tokens**: Nice for maintainability but not user-visible. Existing `dark:` pattern works.
- **Syntax highlighting in code blocks**: Only matters for programming courses. Add based on user feedback.

## Sources

- Codebase analysis: `app/(dashboard)/layout.tsx` (existing dark mode hook), `app/globals.css` (missing directive), lesson detail page (existing feedback flow)
- PROJECT.md requirements (inline feedback as core differentiator, public catalog, shareable links)
