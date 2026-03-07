---
phase: 01-dark-mode
plan: 01
subsystem: ui
tags: [tailwindcss, dark-mode, react-hooks, css-custom-variant, localStorage, matchMedia]

requires: []
provides:
  - CSS-first dark mode activation via @custom-variant dark directive
  - Three-way theme hook (useTheme) with dark/light/system modes
  - ThemeToggle component with sun/moon/monitor icons
  - FOUC prevention script with three-way support
  - Post-hydration transition enabler
affects: [01-dark-mode-plan-02]

tech-stack:
  added: [ts-node, jest-environment-jsdom]
  patterns: [class-based dark mode via .dark selector, three-way theme state management, pure helper functions for testability]

key-files:
  created:
    - lib/hooks/useTheme.ts
    - components/ui/ThemeToggle.tsx
    - components/ui/TransitionEnabler.tsx
    - __tests__/hooks/useTheme.test.ts
  modified:
    - app/globals.css
    - app/layout.tsx

key-decisions:
  - "Used @custom-variant dark with &:where(.dark, .dark *) selector for Tailwind CSS 4 class-based dark mode"
  - "Exported pure helper functions from useTheme for direct unit testability without React rendering"
  - "TransitionEnabler as separate client component to cleanly separate transition-after-paint concern"

patterns-established:
  - "Theme storage: localStorage key 'theme' holds 'dark'|'light', absence means system"
  - "Theme cycling: light -> dark -> system -> light"
  - "FOUC prevention: inline script in <head> applies .dark class before paint"

requirements-completed: [DARK-01, DARK-05, DARK-06]

duration: 5min
completed: 2026-03-05
---

# Phase 1 Plan 01: CSS Dark Mode Foundation Summary

**Tailwind CSS 4 class-based dark mode via @custom-variant directive, three-way useTheme hook with localStorage persistence, and ThemeToggle component with sun/moon/monitor icons**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T17:44:30Z
- **Completed:** 2026-03-05T17:49:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Fixed broken CSS dark mode by adding `@custom-variant dark` directive and replacing `@media (prefers-color-scheme: dark)` with `.dark` class selector
- Created three-way `useTheme` hook supporting dark, light, and system modes with live OS preference sync
- Built `ThemeToggle` component with sun/moon/monitor icons ready for layout integration
- Updated FOUC prevention script with explicit three-way light/dark/system handling
- Added smooth transition enabler that activates after hydration to prevent flash

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix globals.css and create useTheme hook with tests** (TDD)
   - `a17b879` (test) - RED: failing tests for pure helper functions
   - `410346c` (feat) - GREEN: CSS fix + useTheme implementation, 12 tests passing
2. **Task 2: Create ThemeToggle component and update FOUC script** - `758ab39` (feat)

## Files Created/Modified
- `app/globals.css` - Added @custom-variant dark, replaced media query with .dark class selector
- `lib/hooks/useTheme.ts` - Three-way theme hook with pure helpers and matchMedia listener
- `components/ui/ThemeToggle.tsx` - Theme toggle button with mode-specific SVG icons
- `components/ui/TransitionEnabler.tsx` - Adds transition classes to body after first paint
- `app/layout.tsx` - Updated FOUC script for three-way support, added TransitionEnabler
- `__tests__/hooks/useTheme.test.ts` - 12 unit tests for theme logic

## Decisions Made
- Used `@custom-variant dark (&:where(.dark, .dark *))` for Tailwind CSS 4 compatibility -- this is the directive that enables all 726 existing `dark:` utilities to respond to the `.dark` class
- Exported pure helper functions (getStoredTheme, setStoredTheme, resolveEffectiveTheme, applyTheme) separately from the hook for direct unit testing without React rendering overhead
- Created TransitionEnabler as a separate client component rather than an inline script, for cleaner separation of concerns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed ts-node dev dependency**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** Jest 30 requires ts-node to parse TypeScript config file (jest.config.ts)
- **Fix:** Ran `npm install --save-dev ts-node`
- **Files modified:** package.json, package-lock.json
- **Verification:** Jest runs successfully
- **Committed in:** Part of npm install setup (not committed separately as dev dependency)

**2. [Rule 3 - Blocking] Installed jest-environment-jsdom dev dependency**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** jest-environment-jsdom not shipped by default since Jest 28, needed for DOM mocking in useTheme tests
- **Fix:** Ran `npm install --save-dev jest-environment-jsdom`
- **Files modified:** package.json, package-lock.json
- **Verification:** Tests run in jsdom environment with localStorage and matchMedia mocking
- **Committed in:** Part of npm install setup (not committed separately as dev dependency)

---

**Total deviations:** 2 auto-fixed (2 blocking dependencies)
**Impact on plan:** Both were standard test infrastructure dependencies. No scope creep.

## Issues Encountered
- `npm run build` fails during page data collection due to missing JWT_SECRET and MONGODB_URI environment variables -- this is a pre-existing issue unrelated to dark mode changes. TypeScript compilation (`tsc --noEmit`) passes cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ThemeToggle component is ready for Plan 02 to wire into dashboard and auth layouts
- The existing `useDarkMode()` function in `app/(dashboard)/layout.tsx` will be replaced by `useTheme` in Plan 02
- CSS dark mode is fully functional -- adding `.dark` class to `<html>` now activates all `dark:` Tailwind utilities

## Self-Check: PASSED

All 6 created/modified files verified on disk. All 3 task commits (a17b879, 410346c, 758ab39) verified in git log.

---
*Phase: 01-dark-mode*
*Completed: 2026-03-05*
