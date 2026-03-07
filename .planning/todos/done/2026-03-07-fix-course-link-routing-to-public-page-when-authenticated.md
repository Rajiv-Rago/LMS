---
created: 2026-03-07T07:47:24.500Z
title: Fix course link routing to public page when authenticated
area: ui
files:
  - app/(dashboard)/courses/page.tsx
  - app/(auth)/courses/[id]/page.tsx
---

## Problem

Clicking a course card navigates to the public course page (`/courses/[id]` outside the dashboard route group). This page shows "Sign in" and "Get Started" in the navbar even when the user is already authenticated. The tab title shows "Course Not Found".

## Solution

Course cards in the dashboard should link to the dashboard version of the course page. Alternatively, the public course page should detect authenticated users and show the dashboard navbar/layout instead of the public one.
