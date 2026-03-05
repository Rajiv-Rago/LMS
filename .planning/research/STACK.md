# Technology Stack

**Project:** Kantigo UX Polish Milestone
**Researched:** 2026-03-06

## Recommended Stack

This milestone is about UX improvements to an existing brownfield app. The stack is already established (Next.js 16, React 19, Tailwind CSS 4, MongoDB). This document covers **additions and configuration changes** needed for dark mode, inline feedback, and UX polish -- not a stack rewrite.

### Dark Mode Fix (Zero New Dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS 4 `@custom-variant` | Already installed (^4) | Enable class-based dark mode toggle | The app already has a `useDarkMode` hook and FOUC-prevention script that add/remove a `.dark` class on `<html>`. But `globals.css` is missing the `@custom-variant dark` directive, so Tailwind's `dark:` utilities only respond to `prefers-color-scheme` media query, not the class. One CSS line fixes everything. |
| CSS custom properties via `@theme` | Already installed (^4) | Semantic color tokens for dark/light | Tailwind 4's `@theme` directive exposes design tokens as CSS variables. Define semantic tokens (e.g., `--color-surface`, `--color-surface-alt`) that change between `:root` and `.dark :root` for consistent theming without `dark:` on every element. |

**Confidence: HIGH** -- Verified against official Tailwind CSS 4 docs (tailwindcss.com/docs/dark-mode, tailwindcss.com/docs/theme). The `@custom-variant dark (&:where(.dark, .dark *));` directive is the documented approach for class-based toggling in v4.

**The fix:** Add one line to `globals.css`:
```css
@custom-variant dark (&:where(.dark, .dark *));
```

This makes all existing `dark:` classes in the codebase work with the existing `.dark` class toggle. No library needed. No `next-themes` needed.

**Do NOT use `next-themes`:** The app already has a working `useDarkMode` hook in `app/(dashboard)/layout.tsx` and a FOUC-prevention inline script in `app/layout.tsx`. Adding `next-themes` would be redundant and require ripping out existing code. The only missing piece is the CSS directive.

### Typography Dark Mode

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@tailwindcss/typography` | ^0.5.19 (installed) | Prose styling for markdown content | Already using `prose dark:prose-invert` in `MarkdownContent.tsx`. Once `@custom-variant` is added, `dark:prose-invert` will work automatically with the class toggle. |

**Confidence: HIGH** -- `prose-invert` is the established pattern for dark prose styling. Already in codebase, just broken because `dark:` variant doesn't respond to class.

### Inline Feedback UI

No new dependencies needed. The lesson page already has a feedback textarea and regeneration flow (`handleGenerate(feedback)` in the lesson detail page). Improvements are UI/UX work, not library work.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React 19 `useOptimistic` | Already installed (19.2.0) | Optimistic UI for feedback submissions | Show immediate "regenerating" state while the job runs. React 19's `useOptimistic` hook is purpose-built for this. |
| React 19 `useTransition` | Already installed (19.2.0) | Non-blocking UI updates during regeneration | Wrap state updates in transitions to keep the UI responsive during polling/generation. |

**Confidence: HIGH** -- React 19 ships these hooks. No external library needed.

### Content Rendering Enhancements

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-markdown` | ^10.1.0 (installed) | Markdown rendering | Already in use. |
| `remark-gfm` | ^4.0.1 (installed) | GFM tables, strikethrough, task lists | Already in use. |
| `rehype-highlight` or `rehype-prism-plus` | -- | Syntax highlighting for code blocks | **NOT recommended yet.** The current `MarkdownContent.tsx` has custom code block styling. Add syntax highlighting only if users request it -- it adds bundle weight (~20-50KB for highlight.js themes) for a feature that may not matter for non-programming courses. |

**Confidence: MEDIUM** -- Syntax highlighting is a "nice to have" that depends on course content type. Defer unless feedback demands it.

### Public Course Catalog & Discovery

No new dependencies needed. This is a UI page + API route.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| MongoDB text indexes | Already available (Mongoose ^8.19.2) | Search across course titles/descriptions | Mongoose supports `Model.createIndexes()` with `{ title: 'text', description: 'text' }`. No external search service needed at current scale. |
| `URLSearchParams` / Next.js `searchParams` | Built-in | Filter/sort/paginate catalog | Use Next.js App Router's `searchParams` prop for server-side catalog pages. No client-side state management library needed. |

**Confidence: HIGH** -- Standard patterns, already supported by the existing stack.

### Animation & Transitions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS 4 `@theme` keyframes | Already installed (^4) | Define custom animations in CSS | Tailwind 4's `@theme` block supports `@keyframes` definitions. Use for fade-in, slide-in, skeleton shimmer without any animation library. |
| CSS `transition` utilities | Already installed (^4) | Smooth dark mode transitions | Add `transition-colors duration-200` to `body` or key containers for smooth theme switching. Already used in sidebar (`transition-transform duration-200`). |

**Confidence: HIGH** -- Native CSS/Tailwind, no external dependency.

**Do NOT use Framer Motion:** The UX polish work (theme transitions, skeleton loading, feedback animations) doesn't need a 30KB+ animation library. CSS transitions and Tailwind's built-in animation utilities cover all identified needs.

### Toast/Notification System

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom `ToastProvider` | Already built | User feedback for actions | Already exists in `components/ui/Toast.tsx` with success/error/warning/info types and dark mode support. No replacement needed. |

**Confidence: HIGH** -- Already in codebase and working.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Dark mode library | Native `@custom-variant` CSS | `next-themes` | App already has working toggle logic, FOUC script, and `dark:` classes everywhere. `next-themes` would be redundant -- the only missing piece is one CSS line. |
| Animation library | CSS transitions + Tailwind keyframes | `framer-motion` | 30KB+ bundle for transitions achievable with CSS. Overkill for theme switching and skeleton animations. |
| Toast library | Existing custom toast | `sonner` | Custom toast already works, has dark mode support, and matches the design system. Replacing adds migration work for zero user-visible benefit. |
| Search | MongoDB text index | Algolia / Meilisearch | At current scale (hundreds to low thousands of courses), MongoDB text search is sufficient. External search adds infrastructure cost and complexity. Revisit at 10K+ courses. |
| State management | React hooks + `useOptimistic` | Zustand / Jotai | No global state needed beyond what React Context already provides (auth, toast, confirm dialog). The app's state is page-local. |
| Component library | Tailwind utility classes | shadcn/ui, Radix | The app already has a consistent hand-rolled component pattern (Toast, Skeleton, ConfirmDialog, ModelSelector). Introducing a component library mid-project creates inconsistency. Polish the existing components instead. |
| CSS variable theming | `@theme` + `:root` overrides | CSS-in-JS themes | Tailwind 4's CSS variable approach is native and zero-JS. CSS-in-JS adds runtime cost and complexity. |

## Configuration Changes Needed

### globals.css (critical fix)

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

/* Enable class-based dark mode toggle */
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

/* Dark mode overrides via class (not media query) */
.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

Key changes:
1. Added `@custom-variant dark` directive
2. Changed `@media (prefers-color-scheme: dark)` to `.dark` class selector
3. This makes the existing `useDarkMode` hook and FOUC script work correctly

### No new packages to install

```bash
# Nothing to install. Everything needed is already in the stack.
```

## Semantic Color Token Strategy (Optional Enhancement)

For more maintainable dark mode, define semantic tokens in `globals.css`:

```css
:root {
  --color-surface: #ffffff;
  --color-surface-alt: #fafafa;
  --color-border: #e4e4e7;     /* zinc-200 */
  --color-text-primary: #18181b;  /* zinc-900 */
  --color-text-secondary: #71717a; /* zinc-500 */
  --color-text-muted: #a1a1aa;    /* zinc-400 */
}

.dark {
  --color-surface: #18181b;       /* zinc-900 */
  --color-surface-alt: #09090b;   /* zinc-950 */
  --color-border: #27272a;        /* zinc-800 */
  --color-text-primary: #ffffff;
  --color-text-secondary: #a1a1aa; /* zinc-400 */
  --color-text-muted: #71717a;     /* zinc-500 */
}
```

Then use `@theme inline` to register them as Tailwind utilities:
```css
@theme inline {
  --color-surface: var(--color-surface);
  --color-surface-alt: var(--color-surface-alt);
  --color-border: var(--color-border);
}
```

This allows `bg-surface` instead of `bg-white dark:bg-zinc-900` everywhere. **Defer this to a later polish pass** -- the existing `dark:` pattern works fine and is already applied across the codebase. Semantic tokens would be a refactor, not a bug fix.

## Sources

- Tailwind CSS 4 dark mode docs: https://tailwindcss.com/docs/dark-mode (HIGH confidence, official docs)
- Tailwind CSS 4 theme docs: https://tailwindcss.com/docs/theme (HIGH confidence, official docs)
- Tailwind CSS v4 release blog: https://tailwindcss.com/blog/tailwindcss-v4 (HIGH confidence, official)
- Next.js 16 CSS docs: https://nextjs.org/docs/app/building-your-application/styling/css (HIGH confidence, official)
- Codebase analysis of existing dark mode implementation (HIGH confidence, direct inspection)
