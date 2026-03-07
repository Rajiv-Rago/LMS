---
created: 2026-03-07T07:47:24.500Z
title: Fix notifications dropdown overflow
area: ui
files:
  - components/notifications/NotificationDropdown.tsx
---

## Problem

The notifications dropdown panel clips at the right edge of the screen. Notification text gets cut off and is unreadable.

## Solution

Add proper overflow handling — either constrain the dropdown width with `max-w` and truncate text with ellipsis, or reposition the dropdown to stay within viewport bounds (e.g. right-aligned instead of left-aligned from the bell icon).
