# Pagination Plan

This document outlines the changes needed to add consistent pagination across all list-returning API endpoints. The goal is to prevent unbounded query results and ensure a uniform pagination contract for frontend consumers.

---

## Current State

| Endpoint | Has Pagination | Default Limit | Max Limit |
|----------|:--------------:|:-------------:|:---------:|
| `GET /api/courses` | Yes | 10 | — |
| `GET /api/courses/ai/my-courses` | Yes | 10 | — |
| `GET /api/courses/[id]/assignments` | Yes | 20 | 100 |
| `GET /api/courses/[id]/assignments/[id]/submissions` | Yes | 20 | 100 |
| `GET /api/courses/[id]/gradebook` | Yes | 20 | 100 |
| `GET /api/notifications` | Yes | 20 | 50 |
| `GET /api/ai/chat/sessions` | Yes | 20 | — |
| `GET /api/courses/[id]/modules` | **No** | — | — |
| `GET /api/courses/[id]/modules/[id]/lessons` | **No** | — | — |
| `GET /api/admin/trash` | **No** | — | — |
| `GET /api/auth/sessions` | **No** | — | — |

**Endpoints needing pagination: 4**

---

## Standard Pagination Contract

All paginated endpoints should follow this consistent shape:

### Request

Query parameters:
```
?page=1&limit=20
```

- `page` — 1-indexed page number (default: `1`)
- `limit` — items per page (default: per-endpoint, max: per-endpoint)

### Response

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "pages": 8
  }
}
```

### Shared Helper

Create a reusable pagination utility to eliminate duplication:

```typescript
// lib/utils/pagination.ts

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { limit?: number; maxLimit?: number } = {}
): PaginationParams {
  const { limit: defaultLimit = 20, maxLimit = 100 } = defaults;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit), 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, pages: Math.ceil(total / limit) };
}
```

---

## Endpoint-Specific Changes

### 1. `GET /api/courses/[id]/modules`

**File:** `app/api/courses/[id]/modules/route.ts`

**Current behavior:** Returns all modules with nested lessons, sorted by `order`.

**Recommended approach:** Add optional pagination but **default to returning all modules** (modules per course are typically <20, and the frontend renders them as a full sidebar/accordion).

```
Default limit: 50 (effectively unpaginated for most courses)
Max limit: 100
```

**Change:**
```typescript
const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, { limit: 50 });
const [modules, total] = await Promise.all([
  Module.find({ course: id }).sort({ order: 1 }).skip(skip).limit(limit).populate("lessons"),
  Module.countDocuments({ course: id }),
]);
return NextResponse.json({ data: modules, pagination: paginationMeta(page, limit, total) });
```

**Frontend impact:** Low. Most courses won't exceed the default. Frontend should handle the new response shape (`data` array + `pagination` object).

**Risk:** Low.

---

### 2. `GET /api/courses/[id]/modules/[moduleId]/lessons`

**File:** `app/api/courses/[id]/modules/[moduleId]/lessons/route.ts`

**Current behavior:** Returns all lessons in a module, sorted by `order`. Filters by `isPublished` for non-instructors.

**Recommended approach:** Same as modules — add optional pagination with a generous default.

```
Default limit: 50
Max limit: 100
```

**Change:**
```typescript
const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, { limit: 50 });
const filter = isInstructor ? { module: moduleId } : { module: moduleId, isPublished: true };
const [lessons, total] = await Promise.all([
  Lesson.find(filter).sort({ order: 1 }).skip(skip).limit(limit),
  Lesson.countDocuments(filter),
]);
return NextResponse.json({ data: lessons, pagination: paginationMeta(page, limit, total) });
```

**Frontend impact:** Low.

**Risk:** Low.

---

### 3. `GET /api/admin/trash`

**File:** `app/api/admin/trash/route.ts`

**Current behavior:** Returns all soft-deleted courses.

**Recommended approach:** Standard pagination — trash can grow unbounded over time.

```
Default limit: 20
Max limit: 100
```

**Frontend impact:** The admin trash view will need to add page controls. Currently it renders all deleted courses in a single list.

**Risk:** Medium — requires frontend changes for the admin panel.

---

### 4. `GET /api/auth/sessions`

**File:** `app/api/auth/sessions/route.ts`

**Current behavior:** Returns all active sessions for the current user.

**Recommended approach:** Optional pagination with generous default. Users rarely have >10 active sessions.

```
Default limit: 50
Max limit: 50
```

**Frontend impact:** Minimal — the sessions list is typically short.

**Risk:** Low.

---

## Frontend Migration Strategy

The main breaking change is wrapping array responses in `{ data, pagination }`. Two approaches:

### Option A: Gradual Migration (Recommended)

1. Add pagination to backend endpoints but also support the legacy flat-array response via a query param or header
2. Update frontend consumers one at a time
3. Remove legacy support after all consumers are migrated

```typescript
// Backend — transitional period
const wrapResponse = request.nextUrl.searchParams.has("page");
if (wrapResponse) {
  return NextResponse.json({ data: modules, pagination: { ... } });
} else {
  return NextResponse.json(modules); // legacy
}
```

### Option B: Big Bang

1. Add pagination to all backend endpoints at once (wrap in `{ data, pagination }`)
2. Update all frontend fetch calls to read `response.data` instead of the raw array
3. Deploy together

### Frontend Changes Needed

For each paginated endpoint, the frontend consumer will need:

1. **Read from `response.data`** instead of the raw response
2. **Pass `page` and `limit` query params** (optional — defaults work without them)
3. **Render pagination controls** (optional — only needed for endpoints where users navigate pages, like admin trash)

Common frontend files to update:
- Course module sidebar / accordion components
- Lesson list rendering
- Admin trash page
- Session management page

---

## Existing Endpoints — Normalize Response Shape

The 7 endpoints that already have pagination use slightly different response shapes. For consistency, they should also be updated to the standard `{ data, pagination }` shape:

| Endpoint | Current response key | Target |
|----------|---------------------|--------|
| `GET /api/courses` | `courses` | `data` |
| `GET /api/courses/ai/my-courses` | `courses` | `data` |
| `GET /api/courses/[id]/assignments` | `assignments` | `data` |
| `GET /api/courses/[id]/assignments/[id]/submissions` | `submissions` | `data` |
| `GET /api/courses/[id]/gradebook` | `students` + `assignments` | `data` (composite) |
| `GET /api/notifications` | `notifications` | `data` |
| `GET /api/ai/chat/sessions` | `sessions` | `data` |

This normalization is **lower priority** than adding pagination to the 4 missing endpoints but improves frontend consistency long-term.

---

## Implementation Order

1. **Create `lib/utils/pagination.ts`** — shared helper (no frontend impact)
2. **Add pagination to `admin/trash`** — admin-only, least risky
3. **Add pagination to `auth/sessions`** — user-facing but rarely long
4. **Add pagination to `modules` and `lessons`** — most frontend consumers, do together
5. **Normalize existing endpoints** — optional, separate PR

**Estimated scope:** ~2-3 hours backend, ~2-3 hours frontend (depending on migration strategy).
