# Phase 1: Dark Mode - Research

**Researched:** 2026-03-06
**Domain:** CSS theming, Tailwind CSS 4 class-based dark mode, three-way toggle (dark/light/system)
**Confidence:** HIGH

## Summary

The dark mode toggle infrastructure already exists in this codebase: a `useDarkMode` hook, FOUC-prevention inline script, `suppressHydrationWarning` on `<html>`, and 726 `dark:` utility class usages across 42 files. The entire dark mode system is broken by a single missing CSS directive. Tailwind CSS 4 defaults `dark:` utilities to `@media (prefers-color-scheme: dark)`, but this app uses class-based toggling (`.dark` on `<html>`). Adding `@custom-variant dark (&:where(.dark, .dark *));` to `globals.css` fixes all `dark:` utilities instantly.

Beyond the CSS fix, the phase requires: (1) upgrading the binary toggle to three-way (dark/light/system), (2) replacing the `@media (prefers-color-scheme: dark)` CSS variable block with a `.dark` class selector to prevent dual-system conflicts, (3) adding a theme toggle to auth pages, (4) adding 200ms smooth transitions, and (5) adding a `matchMedia` change listener for live OS sync when set to "system". No new dependencies are needed.

**Primary recommendation:** Fix `globals.css` first (one CSS line + one selector change), then verify the entire codebase lights up in dark mode before touching any JavaScript.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three-way toggle: dark / light / system
- Cycling icon button: sun (light) -> moon (dark) -> monitor (system) -> sun
- Tooltip shows current mode name
- Default for new visitors (no localStorage): system (follows OS preference)
- When set to "system", live-sync with OS changes via matchMedia listener (e.g., macOS auto dark at sunset)
- Add a small theme toggle on auth pages (login, register, forgot-password, reset-password) positioned in top-right corner (fixed/absolute)
- Same three-way cycling icon as the dashboard sidebar toggle
- Shares the same localStorage key -- settings carry between auth and dashboard
- Smooth 200ms CSS transition when switching themes
- Applies to backgrounds, text, and border colors (transition-colors on body)
- Skip transition on first page load to avoid flash of transition (add transition class after first paint)

### Claude's Discretion
- Exact icon designs for sun/moon/monitor states
- How to implement the "skip transition on load" (delay vs class toggle approach)
- Markdown prose/code block dark mode styling details
- Any per-component dark mode fixes discovered during implementation

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DARK-01 | Dark/light mode toggle in sidebar visibly changes the app's color scheme | CSS fix (`@custom-variant dark`) makes all existing `dark:` classes work. Upgrade `useDarkMode` to three-way cycle. |
| DARK-02 | Dark mode applies consistently across all dashboard pages | 726 `dark:` classes across 42 files already exist. CSS fix activates them all. Visual audit needed per page after fix. |
| DARK-03 | Dark mode applies to auth pages (login, register, forgot password, reset password) | All 4 auth pages already have `dark:` classes. Auth layout needs theme toggle component in top-right corner. |
| DARK-04 | Markdown/prose content renders correctly in dark mode | `MarkdownContent.tsx` already uses `prose dark:prose-invert`. Custom code/pre blocks have `dark:bg-zinc-800`. Will work after CSS fix. |
| DARK-05 | Theme transitions are smooth (no jarring instant color swap) | Add `transition-colors duration-200` to body. Skip on first load via class toggle approach. |
| DARK-06 | System theme preference respected on first visit, with manual override | FOUC script already checks `matchMedia`. Upgrade to three-way: remove localStorage for "system" mode. Add `matchMedia` change listener. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS 4 `@custom-variant` | ^4 (installed) | Enable class-based dark mode | The documented v4 approach. One CSS line activates all 726 existing `dark:` utilities. |
| `@tailwindcss/typography` | ^0.5.19 (installed) | Prose dark mode via `dark:prose-invert` | Already in use in `MarkdownContent.tsx`. Works automatically once `@custom-variant` is added. |
| CSS `transition` utilities | Built-in | Smooth 200ms theme transitions | `transition-colors duration-200` on body. No animation library needed. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `matchMedia` API | Browser built-in | Detect and listen for OS dark mode changes | When theme is set to "system" -- add `change` event listener for live sync |
| `localStorage` | Browser built-in | Persist theme preference | Store "dark", "light", or remove key for "system" |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `useDarkMode` hook | `next-themes` | App already has working toggle logic, FOUC script, and `dark:` classes everywhere. `next-themes` would be redundant -- the only missing piece is one CSS line. Adding it means ripping out existing code for zero benefit. |
| CSS `transition-colors` | `framer-motion` | 30KB+ bundle for a 200ms color transition achievable with one CSS property. |
| Inline SVG icons | `lucide-react` or `heroicons` | Existing codebase uses inline SVGs everywhere (sidebar, notifications, error pages). Adding an icon library for 3 icons creates inconsistency. |

**Installation:**
```bash
# Nothing to install. Everything needed is already in the stack.
```

## Architecture Patterns

### File Changes Map

```
app/globals.css                      # CSS fix: @custom-variant + .dark selector
app/layout.tsx                       # Update FOUC script for three-way "system" support
app/(dashboard)/layout.tsx           # Extract/upgrade useDarkMode to three-way hook
app/(auth)/layout.tsx                # Add theme toggle component (top-right)
hooks/useTheme.ts (NEW)              # Shared three-way theme hook (or lib/hooks/)
components/ui/ThemeToggle.tsx (NEW)  # Shared toggle button component
```

### Pattern 1: CSS-First Dark Mode Fix (Tailwind CSS 4)

**What:** Add `@custom-variant dark` directive to `globals.css` and replace the `@media (prefers-color-scheme: dark)` block with a `.dark` class selector.

**When to use:** This is the foundational fix. Everything else depends on it.

**Example:**
```css
/* globals.css - Source: https://tailwindcss.com/docs/dark-mode */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
@plugin "@tailwindcss/typography";

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

/* Class-based override instead of @media (prefers-color-scheme: dark) */
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

**Key changes from current `globals.css`:**
1. Added `@custom-variant dark (&:where(.dark, .dark *));` after `@import`
2. Replaced `@media (prefers-color-scheme: dark) { :root { ... } }` with `.dark { ... }`
3. `@custom-variant` declared before `@plugin` to ensure typography plugin picks up the custom dark variant

### Pattern 2: Three-Way Theme State (dark / light / system)

**What:** Theme state has three values. localStorage stores "dark" or "light" explicitly; absence of key means "system".

**When to use:** For the upgraded `useDarkMode` hook (renamed to `useTheme`).

**Example:**
```typescript
// Source: https://tailwindcss.com/docs/dark-mode (three-way toggle pattern)
type ThemeMode = "dark" | "light" | "system";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return "system";
}

function resolveEffectiveTheme(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
}

function setStoredTheme(mode: ThemeMode) {
  if (mode === "system") {
    localStorage.removeItem("theme");
  } else {
    localStorage.setItem("theme", mode);
  }
}
```

### Pattern 3: FOUC Prevention Script (Updated for Three-Way)

**What:** Inline script in `<head>` that runs before paint to set the `.dark` class.

**When to use:** Always in `app/layout.tsx`. Must be synchronous, inline, and in `<head>`.

**Example:**
```typescript
// Updated FOUC script for three-way support
const foucScript = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;
```

**Key difference from current script:** The current script treats `!t` (no stored value) as "use system preference" -- which is correct. But it stores "dark" or "light" on toggle without a "system" concept. The updated script explicitly handles three cases: `t === "dark"`, `t === "light"` (force light, skip system check), and `t === null` (system preference).

### Pattern 4: matchMedia Live Listener for System Mode

**What:** When theme is set to "system", listen for OS preference changes and update the `.dark` class in real time.

**When to use:** Inside the `useTheme` hook, only when `mode === "system"`.

**Example:**
```typescript
// Inside useTheme hook
useEffect(() => {
  if (mode !== "system") return;

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    applyTheme(e.matches);
  };

  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}, [mode]);
```

### Pattern 5: Skip Transition on First Load

**What:** Add `transition-colors duration-200` only after first paint to avoid a visible transition from default to theme colors on page load.

**When to use:** On `<body>` or a root container.

**Example (class toggle approach):**
```typescript
// In root layout or useTheme hook
useEffect(() => {
  // Enable transitions after initial paint
  document.body.classList.add("transition-colors", "duration-200");
}, []);
```

The body starts without transition classes. The FOUC script applies `.dark` instantly (no transition). After React hydrates, the useEffect adds the transition classes, so subsequent toggles are smooth.

### Anti-Patterns to Avoid

- **Global state for theme (React Context/Zustand):** Theme must be available before React hydrates (FOUC prevention). The inline `<script>` + `localStorage` + CSS class pattern is correct. Moving this into React state causes a flash of wrong theme.
- **Dynamic class generation:** `className={dark ? 'bg-zinc-900' : 'bg-white'}` breaks Tailwind's static analysis and duplicates logic `dark:` handles. Always use `dark:` variant.
- **Removing `suppressHydrationWarning`:** The `<html>` element gets `.dark` added by the inline script before React hydrates, causing a mismatch. `suppressHydrationWarning` is intentional.
- **Removing the FOUC inline script:** This prevents flash of wrong theme. It must stay in `<head>`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme persistence + FOUC | Custom Context-based theme provider | localStorage + inline `<script>` + CSS class | Context-based themes always flash wrong theme on load because React must hydrate first. The inline script pattern is the standard solution. |
| OS preference detection | Custom polling interval | `matchMedia("(prefers-color-scheme:dark)")` with `addEventListener("change", ...)` | Browser API provides live events. Polling is wasteful and delayed. |
| Dark mode CSS activation | Manual `.dark` selector overrides per class | `@custom-variant dark` directive | One line activates all 726 `dark:` utilities. Hand-rolling selectors would mean rewriting every component. |

## Common Pitfalls

### Pitfall 1: Missing @custom-variant Directive (THE Core Bug)

**What goes wrong:** The app toggles `.dark` class on `<html>` and every component uses `dark:` utilities, but `globals.css` has no `@custom-variant dark` directive. In Tailwind CSS 4, `dark:` defaults to `@media (prefers-color-scheme: dark)` -- it does NOT respond to a `.dark` class without this directive.
**Why it happens:** Migration from Tailwind CSS 3 (which used `darkMode: 'class'` in `tailwind.config.js`) to v4 (CSS-first config) carried over the JavaScript toggle without updating the CSS.
**How to avoid:** Add `@custom-variant dark (&:where(.dark, .dark *));` to `globals.css` after `@import "tailwindcss"`.
**Warning signs:** Toggle button icon changes but no visual theme change occurs. OS dark mode works but manual toggle doesn't.

### Pitfall 2: CSS Variable Media Query Conflict

**What goes wrong:** `globals.css` currently has `@media (prefers-color-scheme: dark) { :root { --background: #0a0a0a; --foreground: #ededed; } }`. After adding `@custom-variant dark`, there will be TWO dark mode systems: the media query for CSS variables AND the class for Tailwind utilities. If a user toggles to light mode while OS is dark, body background (from media query) stays dark while Tailwind classes switch to light.
**Why it happens:** The media query and class systems are independent and can conflict.
**How to avoid:** Replace `@media (prefers-color-scheme: dark) { :root { ... } }` with `.dark { ... }` in `globals.css`. The FOUC script already handles system preference detection via `matchMedia`.
**Warning signs:** Set OS to dark, toggle app to light. If body background stays dark while cards/text switch to light, the media query is still active.

### Pitfall 3: @custom-variant Order Relative to @plugin

**What goes wrong:** If `@custom-variant dark` is declared after `@plugin "@tailwindcss/typography"`, the typography plugin may not pick up the custom dark variant, causing `dark:prose-invert` to not work correctly with class-based toggling.
**Why it happens:** Plugin initialization may read the variant configuration at load time.
**How to avoid:** Declare `@custom-variant dark` before `@plugin "@tailwindcss/typography"` in `globals.css`.
**Warning signs:** Regular `dark:bg-*` classes work but `dark:prose-invert` doesn't invert markdown content.

### Pitfall 4: Transition Flash on Page Load

**What goes wrong:** Adding `transition-colors duration-200` directly to body CSS means the first paint shows a visible color transition from default white to the theme color.
**Why it happens:** The FOUC script adds `.dark` but the transition is already declared, so the browser animates from no-class to .dark-class.
**How to avoid:** Do NOT put transition classes in CSS. Add them via JavaScript after first paint (in a `useEffect`). The FOUC script runs synchronously before paint, applying `.dark` instantly. The useEffect runs after hydration, adding transition classes for future toggles only.
**Warning signs:** On page load, you see a brief color sweep from light to dark (or vice versa).

### Pitfall 5: localStorage Key Name Mismatch

**What goes wrong:** The current FOUC script reads `localStorage.getItem("theme")` and the `useDarkMode` hook writes `localStorage.setItem("theme", ...)`. The auth page toggle must use the exact same key ("theme") to share state.
**Why it happens:** Different developers implement the same feature independently.
**How to avoid:** Extract the localStorage key as a constant shared between the FOUC script, the theme hook, and any toggle component.
**Warning signs:** Switching theme on login page doesn't persist to dashboard, or vice versa.

### Pitfall 6: select/option Elements in Dark Mode

**What goes wrong:** The register page has a `<select>` element for role selection. Native `<select>` dropdown options inherit some styles but not all dark mode styles on certain browsers. The dropdown menu itself (the OS-native popup) may still appear in light mode.
**Why it happens:** `<option>` elements have limited CSS support across browsers. The `dark:bg-zinc-800` on the `<select>` works for the closed state but the open dropdown is OS-controlled.
**How to avoid:** Accept that native `<select>` dropdowns have limited dark mode support. The select input itself can be styled; the dropdown menu is browser-controlled. This is a known limitation, not a bug.
**Warning signs:** Select element looks dark when closed but dropdown options appear white when opened.

## Code Examples

### globals.css (Complete Fixed Version)

```css
/* Source: https://tailwindcss.com/docs/dark-mode */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
@plugin "@tailwindcss/typography";

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

### Updated FOUC Script

```typescript
// In app/layout.tsx <head>
const foucScript = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;
```

### Three-Way Theme Hook Skeleton

```typescript
// hooks/useTheme.ts (or lib/hooks/useTheme.ts)
type ThemeMode = "dark" | "light" | "system";

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getStoredTheme);

  // Apply theme class
  useEffect(() => {
    applyTheme(resolveEffectiveTheme(mode));
  }, [mode]);

  // Listen for OS changes when in system mode
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  // Cycle: light -> dark -> system -> light
  const cycle = useCallback(() => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : prev === "dark" ? "system" : "light";
      setStoredTheme(next);
      applyTheme(resolveEffectiveTheme(next));
      return next;
    });
  }, []);

  return { mode, cycle };
}
```

### ThemeToggle Component Skeleton

```tsx
// components/ui/ThemeToggle.tsx
function ThemeToggle() {
  const { mode, cycle } = useTheme();

  // Icons: light = sun, dark = moon, system = monitor
  // Tooltip: "Light mode" / "Dark mode" / "System mode"

  return (
    <button
      onClick={cycle}
      className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
      aria-label={`${mode} mode`}
      title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} mode`}
    >
      {mode === "light" && <SunIcon />}
      {mode === "dark" && <MoonIcon />}
      {mode === "system" && <MonitorIcon />}
    </button>
  );
}
```

## State of the Art

| Old Approach (Tailwind v3) | Current Approach (Tailwind v4) | When Changed | Impact |
|---------------------------|-------------------------------|--------------|--------|
| `darkMode: 'class'` in `tailwind.config.js` | `@custom-variant dark (&:where(.dark, .dark *));` in CSS | Tailwind v4.0 (Jan 2025) | Config-file approach no longer works. Must use CSS directive. |
| `@media (prefers-color-scheme: dark)` default | Same default, but `@custom-variant` overrides it | Tailwind v4.0 | Class-based toggle requires explicit opt-in via CSS. |
| `addListener` on matchMedia | `addEventListener("change", ...)` on matchMedia | Modern browsers (iOS 14+) | `addListener` is deprecated. Use standard event API. |

**Deprecated/outdated:**
- `tailwind.config.js` / `tailwind.config.ts` for dark mode configuration -- Tailwind v4 is CSS-first
- `matchMedia().addListener()` -- deprecated in favor of `addEventListener("change", ...)`

## Open Questions

1. **@custom-variant order relative to @plugin**
   - What we know: Official docs show `@custom-variant` after `@import`. No explicit guidance on ordering relative to `@plugin`.
   - What's unclear: Whether the typography plugin's `dark:prose-invert` requires `@custom-variant` to be declared before `@plugin`.
   - Recommendation: Declare `@custom-variant` before `@plugin` to be safe. Test `dark:prose-invert` immediately after the CSS fix.

2. **Existing dashboard pages with missing dark: classes**
   - What we know: 726 `dark:` usages exist across 42 files. Common pattern is consistent (zinc scale, indigo primary).
   - What's unclear: Whether every interactive state (focus rings, disabled states, error messages) has a `dark:` variant.
   - Recommendation: After the CSS fix, do a visual audit of each page in both modes. Fix gaps as discovered (Claude's discretion per CONTEXT.md).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 |
| Config file | `jest.config.ts` |
| Quick run command | `npm test -- --testPathPattern="<pattern>" --forceExit` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DARK-01 | Toggle changes color scheme | manual-only | N/A -- requires browser DOM with CSS | N/A |
| DARK-02 | All dashboard pages render in dark mode | manual-only | N/A -- visual verification across 18 pages | N/A |
| DARK-03 | Auth pages render in dark mode | manual-only | N/A -- visual verification across 4 pages | N/A |
| DARK-04 | Markdown prose/code readable in dark mode | manual-only | N/A -- requires CSS rendering | N/A |
| DARK-05 | Smooth transitions (200ms, no flash on load) | manual-only | N/A -- requires visual timing verification | N/A |
| DARK-06 | System preference respected, manual override works | unit | `npm test -- --testPathPattern="useTheme" --forceExit` | No -- Wave 0 |

**Note:** Dark mode is primarily a CSS/visual concern. Most requirements are manual-only because they require a real browser with CSS rendering. The test environment (`jest-environment-node`) cannot verify visual rendering. The `useTheme` hook logic (three-way state, localStorage, cycling) CAN be unit tested.

### Sampling Rate
- **Per task commit:** `npm test` (ensure no regressions to existing tests)
- **Per wave merge:** `npm test` + manual visual check of all pages in both themes
- **Phase gate:** Full test suite green + manual verification checklist

### Wave 0 Gaps
- [ ] `__tests__/hooks/useTheme.test.ts` -- covers DARK-06 (three-way state logic, localStorage persistence, cycling behavior)
- [ ] Manual verification checklist document -- covers DARK-01 through DARK-05 (list of pages to visually verify)

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS 4 Dark Mode docs](https://tailwindcss.com/docs/dark-mode) -- `@custom-variant dark (&:where(.dark, .dark *));` syntax, three-way toggle JS, class-based approach
- Codebase analysis: `app/globals.css`, `app/layout.tsx`, `app/(dashboard)/layout.tsx`, `app/(auth)/layout.tsx` -- existing dark mode infrastructure
- Codebase analysis: 42 files with `dark:` classes (726 total usages) -- confirms consistent existing pattern

### Secondary (MEDIUM confidence)
- [MDN matchMedia API](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia) -- `addEventListener("change", ...)` for OS preference sync
- [web.dev prefers-color-scheme guide](https://web.dev/articles/prefers-color-scheme) -- three-way toggle pattern, FOUC prevention

### Tertiary (LOW confidence)
- `@custom-variant` ordering relative to `@plugin` -- no official documentation found on this specific ordering concern. Recommendation based on general CSS cascade principles.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, one CSS line fix verified against official docs
- Architecture: HIGH -- all patterns verified against official Tailwind CSS 4 docs and existing codebase inspection
- Pitfalls: HIGH -- core pitfalls (CSS fix, media query conflict) verified; ordering pitfall is MEDIUM (conservative recommendation)

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain, no fast-moving dependencies)
