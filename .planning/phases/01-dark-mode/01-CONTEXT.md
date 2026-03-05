# Phase 1: Dark Mode - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the broken dark/light mode toggle and ensure consistent theming across all pages. The toggle infrastructure exists (useDarkMode hook, FOUC script, 253 dark: classes across 20 files) but has no visual effect because globals.css is missing the Tailwind CSS 4 `@custom-variant dark` directive. This phase fixes the CSS, upgrades the toggle to three-way (dark/light/system), adds a toggle to auth pages, and ensures smooth theme transitions.

</domain>

<decisions>
## Implementation Decisions

### Theme toggle style
- Three-way toggle: dark / light / system
- Cycling icon button: sun (light) -> moon (dark) -> monitor (system) -> sun
- Tooltip shows current mode name
- Default for new visitors (no localStorage): system (follows OS preference)
- When set to "system", live-sync with OS changes via matchMedia listener (e.g., macOS auto dark at sunset)

### Auth page theme access
- Add a small theme toggle on auth pages (login, register, forgot-password, reset-password)
- Positioned in the top-right corner (fixed/absolute)
- Same three-way cycling icon as the dashboard sidebar toggle
- Shares the same localStorage key -- settings carry between auth and dashboard

### Transition feel
- Smooth 200ms CSS transition when switching themes
- Applies to backgrounds, text, and border colors (transition-colors on body)
- Skip transition on first page load to avoid flash of transition (add transition class after first paint)

### Claude's Discretion
- Exact icon designs for sun/moon/monitor states
- How to implement the "skip transition on load" (delay vs class toggle approach)
- Markdown prose/code block dark mode styling details
- Any per-component dark mode fixes discovered during implementation

</decisions>

<specifics>
## Specific Ideas

No specific references -- standard dark mode patterns apply.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useDarkMode()` hook in `app/(dashboard)/layout.tsx`: Binary toggle with localStorage. Needs upgrading to three-way but the pattern is established.
- FOUC prevention script in `app/layout.tsx`: Inline script that reads localStorage and adds `.dark` class before paint. Needs updating to handle "system" value.
- `components/ui/MarkdownContent.tsx`: Already uses `prose dark:prose-invert`. Will work once CSS fix is applied.
- `components/ui/Skeleton.tsx`: Loading skeleton component available for any loading states.

### Established Patterns
- Dark mode classes: `dark:bg-zinc-900`, `dark:text-white`, `dark:border-zinc-800` used consistently across all dashboard components
- Color scheme: Zinc scale for neutrals, indigo-600 for primary, already applied in both light and dark variants
- Sidebar toggle: `transition-colors` already used on interactive elements in sidebar

### Integration Points
- `app/globals.css`: Needs `@custom-variant dark` directive and `.dark` class selector (replacing `@media prefers-color-scheme`)
- `app/layout.tsx`: FOUC script needs updating for three-way "system" support
- `app/(dashboard)/layout.tsx`: `useDarkMode()` hook needs upgrading to three-way cycle
- `app/(auth)/layout.tsx`: Needs theme toggle component added to top-right corner
- Auth pages (4 pages): Already have `dark:` classes -- will work once CSS fix is applied

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 01-dark-mode*
*Context gathered: 2026-03-06*
