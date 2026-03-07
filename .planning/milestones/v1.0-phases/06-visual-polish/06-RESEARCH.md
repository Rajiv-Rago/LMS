# Phase 6: Visual Polish - Research

**Researched:** 2026-03-07
**Domain:** UI consistency, skeleton loading, mobile responsiveness, design system fundamentals
**Confidence:** HIGH

## Summary

Phase 6 covers three core areas: (1) replacing all ad-hoc loading spinners with page-specific skeleton screens, (2) making the dashboard mobile-friendly with a bottom navigation bar, and (3) standardizing typography, spacing, and button styles across all pages. The codebase currently has 10+ pages using spinning circle loaders (`animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600`), zero `loading.tsx` files, no shared Button component, and inconsistent typography/spacing values across pages. The app uses `rounded-md` on buttons in some places and `rounded-lg` in others. There is no icon library installed.

A critical architectural nuance: all pages are `"use client"` with `useEffect`-based data fetching. This means `loading.tsx` files serve as **route transition skeletons** (shown during client-side navigation between pages), while each page's inline loading state handles **data fetch skeletons** (shown after the page mounts but before data arrives). Both layers are needed for a complete skeleton experience. The existing inline loading states should be upgraded to proper page-mimicking skeletons, and new `loading.tsx` files should be added for route-level transitions.

**Primary recommendation:** Work in three waves: (1) foundational components (Button, EmptyState, BottomNav, loading.tsx skeletons), (2) page-by-page polish applying the typography/spacing/button scale, (3) final audit pass for consistency.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Page-specific skeletons that mimic each page's actual layout (not generic reusable blocks)
- Implemented via Next.js `loading.tsx` files in each route directory (route-level Suspense)
- Animation: pulse (existing `animate-pulse`) -- no shimmer
- Replace ALL ad-hoc spinners (border-spinning circles) with skeleton loading states -- no spinning circles anywhere in the app
- Existing `Skeleton.tsx` primitives (Skeleton, SkeletonText, SkeletonCard, SkeletonTable) used as building blocks for page-specific skeletons
- ContentGenerationSkeleton (Phase 5) stays as-is for AI generation in-progress state
- Mobile-friendly experience -- actively optimize for phone usage, not just "doesn't break"
- Bottom navigation bar on mobile: Home, Explore, Courses, Me -- fixed at bottom, visible on all dashboard pages
- Sidebar still accessible via hamburger menu for less-used items
- Bottom nav hidden on desktop (lg: breakpoint and above)
- Course content (lessons, quizzes) stacks vertically on mobile -- module sidebar collapses to top dropdown or accordion
- Enforce 44px minimum touch targets on all interactive elements on mobile
- Typography scale: Page title `text-2xl font-bold`, Section heading `text-lg font-semibold`, Card title `text-base font-semibold`, Body text `text-sm`, Caption/meta `text-xs text-zinc-500`
- Spacing scale: Page padding `p-6` (desktop) / `p-4` (mobile), Section gap `space-y-6`, Card/grid gap `gap-4`, Inner card padding `p-4`
- Create shared `components/ui/Button.tsx` with variant prop (primary, secondary, danger, ghost) and size prop (sm, default)
- All buttons: `rounded-lg font-medium`
- Replace all inline button styles across the app with Button component
- All pages get full polish treatment equally (skeletons + responsive + spacing)
- Public pages use same visual style as dashboard -- no distinct "marketing" feel
- Empty states: Icon (Lucide) + short text message + action button -- consistent with app's style

### Claude's Discretion
- Which Lucide icons to use for each empty state
- Exact bottom nav icons and active state styling
- How module sidebar collapses on mobile (dropdown vs accordion)
- Per-page skeleton layout details
- How to handle the loading.tsx + client component interaction
- Order of page-by-page polish work

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VISL-01 | Loading states use consistent skeleton screens across all pages | Skeleton primitives exist in `components/ui/Skeleton.tsx`; 10+ pages have spinning circle loaders that must be replaced; `loading.tsx` files needed for route-level transitions; inline loading states need upgrading to page-mimicking skeletons |
| VISL-02 | Responsive design works on mobile -- no content overflow or broken layouts | Bottom nav component needed; dashboard layout needs `pb-16` for bottom nav clearance; existing `lg:` breakpoint pattern for sidebar; 44px touch targets; course content needs vertical stacking on mobile |
| VISL-03 | Consistent spacing and typography across dashboard pages | Typography scale defined (text-2xl/text-lg/text-base/text-sm/text-xs); spacing scale defined (p-6/p-4/space-y-6/gap-4/p-4); Button component needed; currently inconsistent -- some pages use text-xl, others text-2xl for titles; buttons mix rounded-md and rounded-lg |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lucide-react | ^0.577.0 | Icon library for empty states and bottom nav | Tree-shakable, fully typed React components, consistent style, widely adopted for Tailwind projects |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwindcss | ^4 (already installed) | Utility CSS framework | All styling -- already the project standard |
| react | 19.2.0 (already installed) | UI framework | Already in use |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| lucide-react | Inline SVG icons (current approach) | Lucide provides 1400+ consistent icons vs hand-drawing SVGs; tree-shakes so no bundle bloat |
| lucide-react | @heroicons/react | Lucide has more icons and is explicitly requested in CONTEXT.md |

**Installation:**
```bash
npm install lucide-react
```

## Architecture Patterns

### Component Structure
```
components/
├── ui/
│   ├── Button.tsx           # NEW: Shared button component
│   ├── EmptyState.tsx       # NEW: Shared empty state component
│   ├── Skeleton.tsx         # EXISTING: Skeleton primitives
│   ├── BottomNav.tsx        # NEW: Mobile bottom navigation
│   ├── ConfirmDialog.tsx    # EXISTING
│   ├── MarkdownContent.tsx  # EXISTING
│   ├── NotificationBell.tsx # EXISTING
│   ├── ThemeToggle.tsx      # EXISTING
│   └── Toast.tsx            # EXISTING
app/
├── (dashboard)/
│   ├── layout.tsx           # MODIFY: Add BottomNav, adjust padding
│   ├── dashboard/
│   │   ├── loading.tsx      # NEW: Route-level skeleton
│   │   └── page.tsx         # MODIFY: Typography/spacing/buttons
│   ├── courses/
│   │   ├── loading.tsx      # NEW
│   │   └── page.tsx         # MODIFY
│   └── [etc for every route]
├── (public)/
│   ├── explore/
│   │   ├── loading.tsx      # NEW
│   │   └── page.tsx         # MODIFY
│   └── courses/[id]/
│       └── ...              # MODIFY
```

### Pattern 1: Button Component
**What:** Shared Button component with variant/size system
**When to use:** Every button in the app
**Example:**
```typescript
// components/ui/Button.tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-400",
  secondary: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700",
  danger: "bg-red-600 text-white hover:bg-red-500",
  ghost: "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  default: "px-4 py-2 text-sm",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "default", className = "", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
export default Button;
```

### Pattern 2: EmptyState Component
**What:** Consistent empty state with Lucide icon, text, optional action
**When to use:** Every page that can have zero items
**Example:**
```typescript
// components/ui/EmptyState.tsx
import type { LucideIcon } from "lucide-react";
import Button from "./Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-4" strokeWidth={1.5} />
      <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">{description}</p>
      )}
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

### Pattern 3: loading.tsx Route Skeleton
**What:** Page-specific skeleton shown during route transitions
**When to use:** Every route directory that has a page.tsx
**Critical note:** Since all pages are `"use client"` with `useEffect` data fetching, `loading.tsx` shows during **navigation transitions** (when Next.js is loading the page JavaScript bundle). The inline `if (loading)` block inside each page handles the **data fetch** loading state. Both must use consistent skeleton patterns.
**Example:**
```typescript
// app/(dashboard)/dashboard/loading.tsx
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Generation input skeleton */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-10 w-full" />
      </div>
      {/* Course cards skeleton */}
      <div>
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Pattern 4: Bottom Navigation
**What:** Fixed bottom nav bar for mobile with 4 tabs
**When to use:** Dashboard layout, hidden on desktop
**Example:**
```typescript
// components/ui/BottomNav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, BookOpen, User } from "lucide-react";

const items = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Explore", href: "/explore", icon: Compass },
  { name: "Courses", href: "/courses", icon: BookOpen },
  { name: "Me", href: "/profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 lg:hidden" aria-label="Mobile navigation">
      <div className="flex items-center justify-around h-16">
        {items.map(({ name, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={name}
              href={href}
              className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] gap-1 text-xs font-medium transition-colors ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### Anti-Patterns to Avoid
- **Generic full-page spinners:** Never use `<div className="animate-spin rounded-full...">`; always use page-shaped skeletons
- **One-size-fits-all skeleton:** Don't use the same SkeletonCard for every page; each loading.tsx and inline loading state should mimic the actual page layout
- **Forgetting bottom nav padding:** When adding the bottom nav, the main content area needs `pb-16 lg:pb-0` to avoid content hiding behind the fixed nav
- **Mixing rounded-md and rounded-lg on buttons:** All buttons use `rounded-lg` per the decision
- **Hardcoding mobile breakpoints inconsistently:** Use `lg:` as the sidebar/bottom-nav breakpoint consistently (the project already uses this)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icons for empty states/nav | Inline SVGs or custom icon components | lucide-react | 1400+ consistent icons, tree-shakeable, TypeScript-native |
| Button variants | Inline className strings on every `<button>` | Shared `Button.tsx` component | 26+ button instances across 17 files -- consistent look requires a single source of truth |
| Empty states | Ad-hoc `<p className="text-zinc-500">No items.</p>` per page | Shared `EmptyState.tsx` | Prevents inconsistent styling; icon + text + action pattern repeated many times |

## Common Pitfalls

### Pitfall 1: loading.tsx Not Showing for Client-Side Pages
**What goes wrong:** Developer adds `loading.tsx` expecting it to show during data fetch, but it only shows during route transitions because the page is `"use client"` with `useEffect` fetching.
**Why it happens:** `loading.tsx` wraps the page in a Suspense boundary. Client components render immediately (not suspended), then fetch data in useEffect.
**How to avoid:** Maintain BOTH `loading.tsx` (for route transitions) AND inline `if (loading)` skeletons (for data fetch). Make both use the same visual skeleton for consistency.
**Warning signs:** Page shows skeleton briefly, then blank white, then content (two loading phases with different UI).

### Pitfall 2: Bottom Nav Obscuring Content
**What goes wrong:** Fixed bottom nav covers the last items in scrollable lists on mobile.
**Why it happens:** `position: fixed` removes the element from document flow, so main content doesn't account for its height.
**How to avoid:** Add `pb-16 lg:pb-0` to the main content wrapper. The bottom nav is `h-16` (64px).
**Warning signs:** Last course card or list item is partially hidden on mobile.

### Pitfall 3: Touch Target Too Small
**What goes wrong:** Buttons and links are hard to tap on mobile -- users miss taps or trigger wrong elements.
**Why it happens:** Default text links and small buttons are often 32px or less.
**How to avoid:** Ensure all interactive elements have at least `min-h-[44px] min-w-[44px]` on mobile. The Button component's `default` size (py-2 = 8px + text-sm line-height ~20px + 8px = 36px) needs adjustment -- add `min-h-[44px]` for mobile or use `py-2.5` on mobile.
**Warning signs:** Apple HIG and WCAG require 44px minimum; test by actually trying to tap elements on a phone.

### Pitfall 4: Inconsistent Dark Mode on New Components
**What goes wrong:** New Button/EmptyState/BottomNav components look correct in light mode but broken in dark mode.
**Why it happens:** Forgetting to add `dark:` variants for backgrounds, borders, and text.
**How to avoid:** Follow the project's established dark mode pattern: bg-white/dark:bg-zinc-900, border-zinc-200/dark:border-zinc-800, text-zinc-900/dark:text-white.
**Warning signs:** Component looks washed out or invisible in dark mode.

### Pitfall 5: Bulk Find-and-Replace Breaking Edge Cases
**What goes wrong:** Replacing all inline button styles with `<Button>` breaks buttons that are actually `<Link>` components styled as buttons, or `<button>` elements with custom event handlers.
**Why it happens:** Not all button-styled elements are `<button>` tags. Some are `<Link>`, `<a>`, or have special disabled states.
**How to avoid:** Replace buttons page by page, testing each. For links styled as buttons, either create a separate `ButtonLink` component or use `className` props on Link directly (keeping consistent with Button styles).
**Warning signs:** Click handlers stop working, or links navigate but don't look like buttons.

### Pitfall 6: Responsive Layout Breaking on Intermediate Screens
**What goes wrong:** Layout works on phone (375px) and desktop (1440px) but breaks at tablet (768px) or small laptop (1024px).
**Why it happens:** Only testing extremes. The `lg:` breakpoint (1024px) is where sidebar appears; `md:` (768px) and `sm:` (640px) need attention too.
**How to avoid:** Test at 375px, 640px, 768px, 1024px, and 1440px. Grid layouts use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (already the pattern).
**Warning signs:** Cards or forms overflow their containers at medium widths.

## Code Examples

### Dashboard Layout Modification (adding bottom nav and mobile padding)
```typescript
// In app/(dashboard)/layout.tsx - main content area change:
// BEFORE:
<main id="main-content" className="lg:pl-64 pt-14 lg:pt-0">
  <div className="p-6">{children}</div>
</main>

// AFTER:
<main id="main-content" className="lg:pl-64 pt-14 lg:pt-0 pb-16 lg:pb-0">
  <div className="p-4 lg:p-6">{children}</div>
</main>
<BottomNav />
```

### Typography Scale Application
```typescript
// BEFORE (inconsistent):
<h1 className="text-xl font-bold">...</h1>        // some pages
<h1 className="text-2xl font-bold">...</h1>        // other pages
<h1 className="text-3xl font-bold">...</h1>        // explore page

// AFTER (consistent):
<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">...</h1>  // ALL page titles
<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">...</h2> // ALL section headings
```

### Replacing Inline Button Styles
```typescript
// BEFORE:
<button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500">
  Save
</button>

// AFTER:
<Button variant="primary">Save</Button>

// BEFORE:
<button className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">
  Cancel
</button>

// AFTER:
<Button variant="ghost">Cancel</Button>
```

### Complete Page Inventory (What Needs Work)

**Dashboard route pages (need loading.tsx + inline skeleton + typography + spacing + buttons):**
1. `/dashboard` - DashboardPage (185 lines) -- has inline skeleton already, needs `loading.tsx` + button + empty state
2. `/courses` - CoursesPage (159 lines) -- has inline skeleton, needs `loading.tsx` + button + empty state
3. `/profile` - ProfilePage (249 lines) -- has inline skeleton, needs `loading.tsx` + buttons
4. `/settings` - SettingsPage (122 lines) -- has inline skeleton, needs `loading.tsx` + button
5. `/courses/[id]/assignments` - AssignmentsPage (417 lines) -- has inline skeleton, needs `loading.tsx` + buttons + empty state
6. `/courses/[id]/assignments/[assignmentId]` - AssignmentDetailPage (516 lines) -- has SPINNER, needs full skeleton + buttons
7. `/courses/[id]/assignments/[assignmentId]/quiz` - QuizPage (442 lines) -- has SPINNER, needs full skeleton
8. `/courses/[id]/assignments/[assignmentId]/submissions` - SubmissionsPage (269 lines) -- has SPINNER, needs skeleton
9. `/courses/[id]/gradebook` - GradebookPage (224 lines) -- has inline skeleton (SkeletonTable), needs `loading.tsx`
10. `/courses/[id]/grades` - StudentGradesPage (196 lines) -- has SPINNER, needs skeleton
11. `/courses/[id]/modules/[moduleId]/lessons/[lessonId]` - LessonDetailPage (754 lines) -- has SPINNER, needs skeleton
12. `/courses/[id]/ai/tutor` - AITutorPage (293 lines) -- needs skeleton
13. `/courses/[id]/ai/generate` - AIGeneratePage (381 lines) -- has SPINNER, needs skeleton
14. `/courses/new` - NewCoursePage (194 lines) -- has SPINNER (admin only)
15. `/courses/new/ai` - NewAICoursePage (384 lines) -- has SPINNER (admin only)

**Public route pages (need loading.tsx + typography + spacing):**
16. `/explore` - ExplorePage (220 lines) -- has local SkeletonCard, needs `loading.tsx`
17. `/courses/[id]` - CoursePreview (375 lines) -- has SkeletonPreview, needs `loading.tsx`

**Other pages (lighter touch):**
18. `/` - Home page (277 lines) -- landing page, typography/spacing audit only
19. Auth pages (login, register, forgot-password, reset-password) -- typography/spacing audit, no data loading

**Spinner locations to replace (10 files):**
- `app/(dashboard)/layout.tsx` (line 60) -- layout auth check spinner
- `app/(dashboard)/courses/new/page.tsx` (line 48)
- `app/(dashboard)/courses/new/ai/page.tsx` (line 181)
- `app/(dashboard)/courses/[id]/modules/[moduleId]/lessons/[lessonId]/page.tsx` (line 361)
- `app/(dashboard)/courses/[id]/assignments/[assignmentId]/page.tsx` (line 160)
- `app/(dashboard)/courses/[id]/assignments/[assignmentId]/quiz/page.tsx` (line 190)
- `app/(dashboard)/courses/[id]/assignments/[assignmentId]/submissions/page.tsx` (line 93)
- `app/(dashboard)/courses/[id]/grades/page.tsx` (line 67)
- `app/(dashboard)/courses/[id]/ai/generate/page.tsx` (line 157)
- `app/(auth)/reset-password/page.tsx` (line 193)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic spinner for all loading | Page-shaped skeleton screens | Standard since 2023 | Better perceived performance, less layout shift |
| Desktop-first then shrink | Mobile-first with bottom nav | Standard pattern for apps | Users expect bottom tab bar from native apps |
| Inline button styles everywhere | Shared Button component | Foundational best practice | Consistency, faster development, fewer bugs |
| No icon library | lucide-react | Mature since 2024 | Tree-shakeable, consistent, 1400+ icons |

**Deprecated/outdated:**
- Spinning circle loaders: perceived as slower than skeletons; create a "waiting" feeling instead of "loading" feeling

## Open Questions

1. **Dashboard layout loading skeleton**
   - What we know: The dashboard layout has its own spinner while checking auth (`if (loading) return <spinner>`)
   - What's unclear: Should this be replaced with a full skeleton of the dashboard chrome (sidebar + main area), or a simpler skeleton since it's very brief?
   - Recommendation: Replace with a skeleton that mimics the sidebar + empty main area since it matches the phase goal of "no spinners anywhere." Keep it simple since auth check is fast.

2. **Explore page architecture**
   - What we know: The Explore page defines its own local `SkeletonCard` that differs from the shared `SkeletonCard` (it includes an aspect-video placeholder)
   - What's unclear: Should we unify these or keep the local one since it's specific to the catalog card layout?
   - Recommendation: Keep the Explore page's local skeleton since it matches its card layout (with image). The shared SkeletonCard is for generic cards. Could extract to a CatalogCardSkeleton if desired.

3. **Link-styled-as-button pattern**
   - What we know: Several places use `<Link>` with button-like styling (e.g., "Get Started" in public layout, "Browse Courses" on home page)
   - What's unclear: Should the Button component also support rendering as a Link, or keep Link styling separate?
   - Recommendation: Keep a pure `<Button>` for actual buttons and create consistent className constants or a small helper for Link-as-button cases. Don't overcomplicate the Button component with polymorphic rendering.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 with next/jest |
| Config file | `jest.config.ts` |
| Quick run command | `npm test -- --testPathPattern="PATTERN" --forceExit` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VISL-01 | Skeleton screens on all loading pages | manual-only | Visual inspection across all routes | N/A |
| VISL-02 | Mobile responsive - no overflow/broken layouts | manual-only | Visual inspection at 375px/640px/768px/1024px | N/A |
| VISL-03 | Consistent spacing and typography | manual-only | Visual comparison across pages | N/A |

**Manual-only justification:** All three requirements are visual/layout requirements. The project uses `jest-environment-node` (no DOM/browser), no component testing library (no @testing-library/react), and no visual regression testing tools. These requirements are best verified by visual inspection at the specified breakpoints. The existing test infrastructure covers API routes and business logic, not UI rendering.

### Sampling Rate
- **Per task commit:** Visual inspection of affected pages at mobile and desktop widths
- **Per wave merge:** Full navigation walkthrough at 375px and 1440px widths
- **Phase gate:** Complete page-by-page audit at mobile (375px), tablet (768px), and desktop (1440px)

### Wave 0 Gaps
None -- existing test infrastructure does not cover UI rendering (node environment, no component tests), and adding visual regression testing is out of scope for this phase. Validation is manual visual inspection.

## Sources

### Primary (HIGH confidence)
- Codebase analysis -- direct reading of all 19 page files, 23 component files, layouts, globals.css
- [Next.js loading.tsx docs](https://nextjs.org/docs/app/api-reference/file-conventions/loading) -- loading.tsx creates Suspense boundary around page
- [Next.js Loading UI and Streaming](https://nextjs.org/docs/14/app/building-your-application/routing/loading-ui-and-streaming) -- instant loading states during navigation
- [lucide-react npm](https://www.npmjs.com/package/lucide-react) -- v0.577.0, tree-shakeable React icon components

### Secondary (MEDIUM confidence)
- [Flowbite Bottom Navigation](https://flowbite.com/docs/components/bottom-navigation/) -- fixed bottom nav pattern reference
- [Next.js Streaming Guide](https://dev.to/boopykiki/a-complete-nextjs-streaming-guide-loadingtsx-suspense-and-performance-9g9) -- loading.tsx + client component interaction

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - lucide-react is the only new dependency; everything else is Tailwind utility classes
- Architecture: HIGH - patterns are straightforward component extraction + per-page `loading.tsx` files; no novel architecture
- Pitfalls: HIGH - identified from direct codebase analysis (specific spinner locations, specific pages needing work)

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable domain -- UI patterns don't change rapidly)
