# 06 - Migration Plan (localStorage → MongoDB)

## Status: DRAFT
## Last Updated: 2026-02-21

---

## Overview

The current app stores all data in browser localStorage. We need to:

1. Move data persistence to MongoDB via API calls
2. Keep localStorage as an offline cache/fallback during transition
3. Offer existing users a one-time data import when they first sign up

---

## What Changes

| Component | Before | After |
|-----------|--------|-------|
| `src/lib/storage.ts` | Core persistence layer | **Deprecated**. Keep for migration import only. |
| `src/context/PathContext.tsx` | Calls `storage.*` directly | Calls API routes (`fetch /api/paths/*`) |
| Data creation | Client-side ID generation (`path_${Date.now()}`) | Server-side MongoDB `_id` |
| Data ownership | Anonymous, browser-scoped | User-scoped, server-persisted |

---

## Step-by-Step Migration

### Step 1: Build API Routes First

Before touching any frontend code, implement all CRUD API routes:

- `GET /api/paths` — list paths
- `POST /api/generate` — create path (already exists, update to save to DB)
- `GET /api/paths/:id` — get path
- `DELETE /api/paths/:id` — delete path
- `GET /api/paths/:id/progress` — get progress
- `PATCH /api/paths/:id/progress` — update progress

Each route must:
- Authenticate the user via `auth()`
- Validate input via Zod
- Read/write to MongoDB via Mongoose models
- Return proper status codes and error shapes

**Acceptance criteria:** All routes work when tested directly via curl/Postman.

---

### Step 2: Refactor PathContext

Replace all `storage.*` calls in `PathContext.tsx` with `fetch()` calls to the new API routes.

**Before (current):**
```typescript
const generatePath = useCallback(async (formData: FormData) => {
  const res = await fetch("/api/generate", { ... });
  const path = await res.json();
  storage.savePath(path);           // ← localStorage
  setCurrentPathState(path);
  setCurrentProgress(storage.getProgress(path.id));  // ← localStorage
  refreshPaths();
}, []);
```

**After (new):**
```typescript
const generatePath = useCallback(async (formData: FormData) => {
  const res = await fetch("/api/generate", { ... });
  const path = await res.json();
  // Path is already saved to DB by the API route
  setCurrentPathState(path);

  // Fetch progress from API
  const progressRes = await fetch(`/api/paths/${path._id}/progress`);
  const progress = await progressRes.json();
  setCurrentProgress(progress);

  refreshPaths();
}, []);
```

**Full list of changes in PathContext:**

| Method | Before | After |
|--------|--------|-------|
| `refreshPaths` | `storage.getAllPaths()` | `fetch("/api/paths")` |
| `setCurrentPath` | `storage.getPath(id)` + `storage.getProgress(id)` | `fetch("/api/paths/${id}")` + `fetch("/api/paths/${id}/progress")` |
| `generatePath` | `storage.savePath(path)` | API route saves to DB |
| `markVideoStatus` | `storage.updateVideoStatus(...)` | `fetch PATCH /api/paths/${id}/progress` with `action: "video_status"` |
| `updateNotes` | `storage.updateVideoNotes(...)` | `fetch PATCH ...` with `action: "update_notes"` |
| `addTimestamp` | `storage.addVideoTimestamp(...)` | `fetch PATCH ...` with `action: "add_timestamp"` |
| `toggleCheck` | `storage.toggleModuleCheck(...)` | `fetch PATCH ...` with `action: "toggle_check"` |
| `switchVariant` | `storage.setActiveVariant(...)` | `fetch PATCH ...` with `action: "switch_variant"` |
| `completeProject` | `storage.markProjectComplete(...)` | `fetch PATCH ...` with `action: "complete_project"` |
| `removePath` | `storage.deletePath(...)` | `fetch DELETE /api/paths/${id}` |

---

### Step 3: Update Path Page Routing

**Before:** `/path?id=path_1234567890`
**After:** `/path/[id]` where `id` is a MongoDB ObjectId string

Update:
- `src/app/path/page.tsx` → `src/app/(app)/path/[id]/page.tsx`
- Remove `useSearchParams()` for path ID, use `params.id` instead
- Update all internal links that reference `/path?id=`

---

### Step 4: Update Generate Route

The existing `POST /api/generate` route needs these changes:

1. **Add auth check** at the top
2. **Add tier/usage check** before calling YouTube/Groq APIs
3. **Save to MongoDB** instead of returning raw data for client-side storage
4. **Create initial progress document** in `path_progress` collection
5. **Increment `pathsGeneratedThisMonth`** on the user
6. **Return the saved document** (with MongoDB `_id`)

```typescript
// Pseudocode for updated route
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return unauthorized();

  const body = await req.json();
  const validation = validateBody(generatePathSchema, body);
  if (!validation.success) return badRequest(validation.error);

  await connectDB();
  const user = await User.findById(session.user.id);

  // Check limits
  checkPathLimit(user);
  checkGenerationLimit(user);

  // Search YouTube (existing logic)
  const videos = await searchVideos(youtubeKey, { ... });

  // Generate with AI (existing logic)
  const pathData = await generateLearningPath(groqKey, formData, videos);

  // Save to MongoDB
  const path = await LearningPath.create({
    userId: user._id,
    ...pathData,
  });

  // Create initial progress
  const videoProgress = new Map();
  for (const mod of path.modules) {
    for (const vid of mod.videos) {
      videoProgress.set(vid.videoId, {
        status: "unwatched",
        watchedAt: null,
        notes: "",
        timestamps: [],
      });
    }
  }
  await PathProgress.create({
    userId: user._id,
    pathId: path._id,
    videoProgress,
  });

  // Increment usage
  await User.findByIdAndUpdate(user._id, {
    $inc: { pathsGeneratedThisMonth: 1 },
  });

  return NextResponse.json(path, { status: 201 });
}
```

---

### Step 5: One-Time Data Import (Existing Users)

For users who had data in localStorage before signing up, offer a one-time import.

#### Detection
On first sign-in, check if `localStorage.getItem("yt-learning-paths")` has data.

#### Import Flow
1. After sign-in, client checks localStorage for existing data
2. If data exists, show a banner: "We found X learning paths from before you signed up. Import them?"
3. User clicks "Import" → client sends all paths to import endpoint
4. Clear localStorage after successful import

#### API Route: `POST /api/paths/import`

```
POST /api/paths/import
Content-Type: application/json

{
  "paths": { ... },      // Record<string, LearningPath> from localStorage
  "progress": { ... }    // Record<string, PathProgress> from localStorage
}
```

**Implementation:**
1. Validate the incoming data structure loosely (it's legacy format)
2. For each path: create a `LearningPath` document with `userId` set
3. For each progress: create a `PathProgress` document linked to the new path `_id`
4. Map old `path_xxx` IDs to new MongoDB `_id`s
5. Return count of imported paths

**Limit:** Maximum 10 paths per import (prevent abuse)

---

### Step 6: Remove localStorage Dependency

After the import feature is live and stable (give it 2-4 weeks):

1. Remove the import banner/flow
2. Delete `src/lib/storage.ts`
3. Remove any remaining localStorage references
4. Clean up old data format types if no longer needed

---

## Migration Timeline

| Phase | What | Duration | Dependencies |
|-------|------|----------|-------------|
| 1 | Build Mongoose models + API routes | 3-4 days | Database schema finalized |
| 2 | Refactor PathContext to use API | 2-3 days | Phase 1 complete |
| 3 | Update routing (`/path?id=` → `/path/[id]`) | 1 day | Phase 2 complete |
| 4 | Update generate route (auth + DB save) | 1-2 days | Phase 1 + auth complete |
| 5 | Build import endpoint + banner UI | 1-2 days | Phase 1-4 complete |
| 6 | Remove localStorage (cleanup) | 0.5 day | Phase 5 stable for 2+ weeks |

**Total: ~8-12 days of dev work** (can be parallelized with auth and billing work)

---

## Rollback Plan

If something breaks during migration:

1. PathContext can fall back to `storage.*` calls (don't delete `storage.ts` until Step 6)
2. The old `/path?id=` route can coexist with `/path/[id]` temporarily
3. MongoDB data can be exported and re-imported if schema changes are needed

Keep `storage.ts` intact until all APIs are stable and tested.
