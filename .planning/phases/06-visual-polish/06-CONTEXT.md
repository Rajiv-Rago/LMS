# Phase 6: Visual Polish - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

The app feels consistent and professional across all screen sizes with polished loading states. This phase standardizes loading skeletons, makes the app mobile-friendly with a bottom navigation bar, defines and applies a typography/spacing scale, creates a shared Button component, and polishes all pages equally — both dashboard and public.

</domain>

<decisions>
## Implementation Decisions

### Skeleton loading approach
- Page-specific skeletons that mimic each page's actual layout (not generic reusable blocks)
- Implemented via Next.js `loading.tsx` files in each route directory (route-level Suspense)
- Animation: pulse (existing `animate-pulse`) — no shimmer
- Replace ALL ad-hoc spinners (border-spinning circles) with skeleton loading states — no spinning circles anywhere in the app
- Existing `Skeleton.tsx` primitives (Skeleton, SkeletonText, SkeletonCard, SkeletonTable) used as building blocks for page-specific skeletons
- ContentGenerationSkeleton (Phase 5) stays as-is for AI generation in-progress state

### Mobile responsiveness
- Mobile-friendly experience — actively optimize for phone usage, not just "doesn't break"
- Bottom navigation bar on mobile: Home, Explore, Courses, Me — fixed at bottom, visible on all dashboard pages
- Sidebar still accessible via hamburger menu for less-used items
- Bottom nav hidden on desktop (lg: breakpoint and above)
- Course content (lessons, quizzes) stacks vertically on mobile — module sidebar collapses to top dropdown or accordion
- Enforce 44px minimum touch targets on all interactive elements (buttons, links, tappable areas) on mobile
- May need slightly different button sizing at sm: breakpoint

### Typography scale
- Page title: `text-2xl font-bold`
- Section heading: `text-lg font-semibold`
- Card title: `text-base font-semibold`
- Body text: `text-sm`
- Caption/meta: `text-xs text-zinc-500`
- Apply this hierarchy consistently across all pages — audit and replace ad-hoc values

### Spacing scale
- Page padding: `p-6` (desktop), `p-4` (mobile)
- Section gap: `space-y-6`
- Card/grid gap: `gap-4`
- Inner card padding: `p-4`
- Apply consistently — replace ad-hoc spacing values

### Button component
- Create shared `components/ui/Button.tsx` with variant prop and size prop
- Variants: primary (`bg-indigo-600 text-white`), secondary (`bg-zinc-100 dark:bg-zinc-800`), danger (`bg-red-600 text-white`), ghost (`text-zinc-600 hover:bg-zinc-100`)
- Sizes: sm (`px-3 py-1.5 text-sm`), default (`px-4 py-2 text-sm`)
- All buttons: `rounded-lg font-medium`
- Replace all inline button styles across the app with this component

### Page priority
- All pages get full polish treatment equally (skeletons + responsive + spacing)
- Public pages (Explore catalog, Course preview) use same visual style as dashboard — no distinct "marketing" feel
- Consistent brand language before and after login

### Empty states
- Icon (Lucide) + short text message + action button
- Clean, minimal — consistent with the app's style
- Every page with potential empty state gets this treatment

### Claude's Discretion
- Which Lucide icons to use for each empty state
- Exact bottom nav icons and active state styling
- How module sidebar collapses on mobile (dropdown vs accordion)
- Per-page skeleton layout details
- How to handle the loading.tsx + client component interaction (where pages are currently client-rendered)
- Order of page-by-page polish work

</decisions>

<specifics>
## Specific Ideas

- Bottom nav items: Home, Explore, Courses, Me — mirrors the core user journey
- Button component API: `<Button variant="primary">Save</Button>`, `<Button variant="secondary" size="sm">Cancel</Button>`
- Empty state pattern: centered icon + heading + description + CTA button
- Typography preview was approved as-is (text-2xl/text-lg/text-base/text-sm/text-xs hierarchy)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/Skeleton.tsx`: Generic skeleton primitives (Skeleton, SkeletonText, SkeletonCard, SkeletonTable) — building blocks for page-specific skeletons
- `components/lesson/ContentGenerationSkeleton.tsx`: AI content generation skeleton — keep as-is
- `components/ui/Toast.tsx`: Toast notifications — consistent with polish goals
- `components/ui/ConfirmDialog.tsx`: Modal dialog with focus trap — already polished
- `components/ui/ThemeToggle.tsx`: Theme toggle — already done in Phase 1

### Established Patterns
- Dark mode: `dark:bg-zinc-900`, `dark:text-white`, `dark:border-zinc-800` consistently applied
- Color scheme: indigo-600 primary, zinc neutrals, indigo-to-violet gradient
- Responsive: `lg:` breakpoint for sidebar collapse, grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Mobile header: Fixed top header with hamburger at `lg:hidden`

### Integration Points
- `app/(dashboard)/layout.tsx`: Add bottom nav component, adjust padding for bottom nav on mobile
- Every route directory: Add `loading.tsx` files
- All page components: Apply typography/spacing scale, replace inline button styles with Button component
- `app/(public)/` route group: Same style treatment as dashboard
- `app/globals.css`: May need utility classes for the spacing/typography scale

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-visual-polish*
*Context gathered: 2026-03-07*
