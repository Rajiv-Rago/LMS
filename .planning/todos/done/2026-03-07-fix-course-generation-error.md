---
created: 2026-03-07T07:47:24.500Z
title: Fix course generation error
area: api
files:
  - app/api/courses/ai/generate/route.ts
---

## Problem

Clicking "Generate" for a new course returns: `error: "Something went wrong. Please try again later."` — generic error with no specifics. Need to investigate whether it's an AI provider config issue, missing API key, or a code bug.

## Solution

TBD — check server logs, verify AI provider key is set correctly in .env, and inspect the generate route error handling for the actual failure reason.
