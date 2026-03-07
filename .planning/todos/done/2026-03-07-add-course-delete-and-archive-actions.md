---
created: 2026-03-07T07:47:24.500Z
title: Add course delete and archive actions
area: ui
files:
  - app/(dashboard)/courses/page.tsx
  - app/api/courses/[id]/route.ts
---

## Problem

There's no way to delete or archive courses from the dashboard. Course cards have no management actions (delete, archive, etc.). Users accumulate courses with no way to clean up.

## Solution

Add a context menu or action buttons on course cards (e.g. three-dot menu) with Delete and Archive options. Archive moves to a hidden state (filterable). Delete requires confirmation and removes the course + associated modules/lessons.
