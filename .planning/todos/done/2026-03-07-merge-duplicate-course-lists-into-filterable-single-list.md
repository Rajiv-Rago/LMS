---
created: 2026-03-07T07:47:24.500Z
title: Merge duplicate course lists into filterable single list
area: ui
files:
  - app/(dashboard)/courses/page.tsx
---

## Problem

The dashboard courses page shows courses twice — once under "My Courses" and again under "Enrolled Courses". The same courses appear in both sections. Enrolled courses don't get removed when the user finishes them, so the separation adds no value.

## Solution

Replace the two sections with a single course list. Add a persistent filter (e.g. All / Active / Completed) so users can narrow down if needed. The filter state could be stored in URL params or localStorage for persistence.
