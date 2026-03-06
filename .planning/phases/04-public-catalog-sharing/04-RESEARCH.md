# Phase 4: Public Catalog & Sharing - Research

**Researched:** 2026-03-07
**Domain:** Next.js public pages, Open Graph metadata, three-tier course access, auto-enrollment flow
**Confidence:** HIGH

## Summary

Phase 4 transforms Kantigo from a private dashboard app into a publicly discoverable platform. The core work spans four areas: (1) a new three-tier access model on the Course schema, (2) public pages at `/explore` and `/courses/[id]` with server-rendered metadata, (3) auto-enrollment after authentication, and (4) Open Graph image generation for link previews.

The existing codebase is well-positioned for this phase. The `GET /api/courses` route already handles unauthenticated requests with `isPublished` filtering and text search. The `GET /api/courses/[id]` route already supports optional auth. The `Enrollment` model has `isEnrolled()` and `getEnrollmentCount()` statics. The cache module supports prefix invalidation. The primary challenge is architectural: the current course detail page at `app/(dashboard)/courses/[id]/page.tsx` is a 1000+ line client component that assumes authenticated context. The public course detail page needs to be a separate server component with `generateMetadata` for OG tags, then delegate to a client component for interactive features (enroll button, syllabus accordion).

**Primary recommendation:** Add an `accessLevel` field to the Course schema (`restricted` | `unlisted` | `published`), create a new `app/(public)/` route group for `/explore` and public `/courses/[id]`, use `generateMetadata` + `opengraph-image.tsx` for dynamic OG, and pipe `?enroll=courseId` through auth pages for post-login auto-enrollment.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three-tier access model: Restricted (default), Anyone with the link (unlisted), Published to catalog
- Courses are private by default (isPublished default already false)
- Share controls live on the course detail page (not a separate manage page)
- Dropdown for access level + "Add people" input + "Copy link" button (Google Docs sharing dialog style)
- Card grid layout: 3 columns desktop, 2 tablet, 1 mobile
- Each card shows: cover image (or fallback), title, description snippet, lesson count, enrollment count
- Default sort: most enrolled first (social proof)
- Hero search bar at the top: "Explore courses" heading
- Pagination: "Load more" button (12 courses per page), not infinite scroll
- Empty search state: "No courses found for 'X'. Be the first to create one!" with CTA
- Syllabus preview visible to unauthenticated visitors: module names, lesson titles with type icons, quiz indicators
- Lesson content strictly locked -- clicking a lesson shows "Enroll to access this lesson"
- Enrollment count shown as social proof
- Creator attribution: "Created by [Name] with AI" for AI-generated, "Created by [Name]" for admin-created
- Skill level badge when available (from youtubeMetadata.skillLevel)
- Auto-enroll after auth: store course ID in URL param (`/login?enroll=courseId`)
- Public catalog at `/explore`
- Landing page: secondary CTA "Browse Courses" alongside primary
- Dashboard sidebar: add "Explore" link
- `/explore` hides courses the logged-in user already owns or is enrolled in
- Public pages use minimal header: logo + "Sign in" / "Get Started" buttons (no sidebar)
- Shareable URL = public detail page URL (`/courses/[id]`)
- Static branded Kantigo OG image: indigo gradient background with course title overlaid
- OG description: first 150 characters of course description
- "Copy link" button with toast confirmation
- `generateMetadata()` on the public course detail page for per-course OG tags

### Claude's Discretion
- Card cover image fallback design (gradient with initial, plain gradient, or no image area)
- Exact share dialog component design and positioning on the course detail page
- How to implement the three-tier access model in the database (new field vs. repurposing isPublished)
- Loading skeleton designs for catalog and course detail pages
- Search debounce timing and behavior
- How to handle the "Add people" sharing UX (email input, autocomplete, etc.)

### Deferred Ideas (OUT OF SCOPE)
- Share a course as a template that the recipient generates their own copy of
- Course categories/tags for filtered browsing (CATL-05, v2)
- Popular/trending courses section (CATL-06, v2)
- Course rating system (CATL-07, v2)
- Monetization for course creators
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CATL-01 | Public course catalog page is browsable without authentication | New `/explore` page in `(public)` route group; existing `GET /api/courses` already filters `isPublished: true` for unauthenticated users; needs new `accessLevel` field query |
| CATL-02 | Catalog supports keyword search across course titles and descriptions | MongoDB text index `{ title: "text", description: "text" }` already exists on Course schema; existing search param handling in GET route |
| CATL-03 | User can enroll in a course from the catalog with one click (redirects to login if needed) | Auto-enroll via `?enroll=courseId` URL param on login/register pages; existing `POST /api/courses/[id]/enroll` endpoint |
| CATL-04 | Courses have shareable URLs with Open Graph metadata for link previews | `generateMetadata` on `app/(public)/courses/[id]/page.tsx` + `opengraph-image.tsx` using Next.js `ImageResponse` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App Router, `generateMetadata`, `ImageResponse` for OG | Already in project; metadata APIs are built-in |
| React | 19 | Server + Client components | Already in project |
| Mongoose | 8.19.2 | Course schema update, queries | Already in project |
| Tailwind CSS | 4 | Card grid, responsive layout, gradient OG backgrounds | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/og` (ImageResponse) | built-in | Dynamic OG image generation | For `opengraph-image.tsx` per-course images |
| Zod | 4 | Validation for new access level field updates | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `opengraph-image.tsx` (dynamic) | Static branded OG image | User decided on "indigo gradient background with course title overlaid" -- requires dynamic generation |
| New `accessLevel` field | Repurposing `isPublished` boolean | `isPublished` is binary; three tiers need a string enum field. Keep `isPublished` as computed for backward compat |

**Installation:**
No new packages needed. All required tools are built into Next.js and already in the project.

## Architecture Patterns

### Recommended Project Structure
```
app/
├── (public)/                    # NEW route group -- no sidebar, public nav header
│   ├── layout.tsx               # Minimal header: logo + Sign in / Get Started
│   ├── explore/
│   │   └── page.tsx             # Catalog page (client component)
│   └── courses/
│       └── [id]/
│           ├── page.tsx         # Server component wrapper with generateMetadata
│           ├── CoursePreview.tsx # Client component for interactive preview
│           └── opengraph-image.tsx  # Dynamic OG image generator
├── (dashboard)/                 # Existing -- sidebar layout, authenticated
│   └── courses/[id]/page.tsx    # Existing course detail (for enrolled/owner users)
├── (auth)/                      # Existing -- login/register
│   ├── login/page.tsx           # Modified: handle ?enroll=courseId param
│   └── register/page.tsx        # Modified: handle ?enroll=courseId param
└── page.tsx                     # Landing page -- add "Browse Courses" CTA
```

### Pattern 1: Three-Tier Access Model in Database
**What:** Add `accessLevel` enum field to Course schema alongside existing `isPublished`
**When to use:** All course visibility and access control decisions
**Recommendation:** Add `accessLevel: 'restricted' | 'unlisted' | 'published'` to Course schema, defaulting to `'restricted'`. Keep `isPublished` as a virtual or computed value (`accessLevel !== 'restricted'`) for backward compatibility with existing queries. Update `getCoursePermissions` to account for `accessLevel`.

```typescript
// Course schema addition
accessLevel: {
  type: String,
  enum: ['restricted', 'unlisted', 'published'],
  default: 'restricted',
},
```

**Access control logic:**
- `restricted`: Only owner/instructor/admin/sharedWith can view
- `unlisted`: Anyone with the URL can view and enroll, but not in catalog search
- `published`: Appears in catalog search, anyone can view and enroll

**Migration consideration:** Existing courses with `isPublished: true` should map to `accessLevel: 'published'`. Existing courses with `isPublished: false` should map to `accessLevel: 'restricted'`.

### Pattern 2: Server Component + Client Component Split for Public Course Page
**What:** The public course detail page needs `generateMetadata` (server-only) but also interactive UI (enroll button, accordions). Split into a server page wrapper and a client component.
**When to use:** Any page that needs both SEO metadata and client interactivity

```typescript
// app/(public)/courses/[id]/page.tsx (Server Component)
import { Metadata } from 'next';
import { dbConnect } from '@/lib/db';
import Course from '@/lib/models/Course';
import CoursePreview from './CoursePreview';

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  await dbConnect();
  const course = await Course.findById(id).populate('instructor', 'name');
  if (!course) return { title: 'Course Not Found' };

  return {
    title: `${course.title} | Kantigo`,
    description: course.description.slice(0, 150),
    openGraph: {
      title: course.title,
      description: course.description.slice(0, 150),
      type: 'website',
    },
  };
}

export default async function PublicCoursePage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Pass ID to client component which fetches via API
  return <CoursePreview courseId={id} />;
}
```

### Pattern 3: Dynamic OG Image with ImageResponse
**What:** Generate a branded OG image per course with indigo gradient background and course title
**When to use:** For the `opengraph-image.tsx` file convention

```typescript
// app/(public)/courses/[id]/opengraph-image.tsx
import { ImageResponse } from 'next/og';
import { dbConnect } from '@/lib/db';
import Course from '@/lib/models/Course';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { id: string } }) {
  await dbConnect();
  const course = await Course.findById(params.id);

  return new ImageResponse(
    (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        padding: '60px',
      }}>
        <div style={{
          fontSize: 64,
          fontWeight: 'bold',
          color: 'white',
          textAlign: 'center',
          lineHeight: 1.2,
        }}>
          {course?.title || 'Course'}
        </div>
        <div style={{
          fontSize: 28,
          color: '#c7d2fe',
          marginTop: '24px',
        }}>
          kantigo.dev
        </div>
      </div>
    )
  );
}
```

### Pattern 4: Auto-Enrollment After Auth
**What:** Pipe `?enroll=courseId` through login/register, auto-enroll after successful auth, redirect to course
**When to use:** When unauthenticated user clicks "Enroll" on public course page

```typescript
// In login/register page (modified)
const searchParams = useSearchParams();
const enrollCourseId = searchParams.get('enroll');

// After successful auth:
if (enrollCourseId) {
  await fetch(`/api/courses/${enrollCourseId}/enroll`, {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  router.push(`/courses/${enrollCourseId}`);
} else {
  router.push('/dashboard');
}
```

### Pattern 5: Catalog Query for Explore Page
**What:** Modify `GET /api/courses` to support catalog-specific queries
**When to use:** When fetching courses for the `/explore` page

The existing API already handles unauthenticated requests (`isPublished: true`). For authenticated users on `/explore`, the query needs to:
1. Filter only `accessLevel: 'published'` courses
2. Exclude courses the user owns, instructs, or is enrolled in
3. Sort by enrollment count (not createdAt)

```typescript
// New catalog-specific query for authenticated users on /explore
query = {
  accessLevel: 'published',
  instructor: { $ne: user.userId },
  owner: { $ne: user.userId },
  _id: { $nin: enrolledCourseIds },
};
```

For sorting by enrollment count, aggregate pipeline or a denormalized `enrolledCount` field on Course schema would be needed. A denormalized counter is simpler and faster for sorting.

### Anti-Patterns to Avoid
- **Reusing the dashboard course detail page for public view:** The dashboard page is 1000+ lines of client-side code with auth assumptions. Create a separate, focused public preview component.
- **Putting public pages inside the `(dashboard)` route group:** This would force the sidebar layout and auth check. Use a new `(public)` route group.
- **Using `generateMetadata` in a `"use client"` component:** `generateMetadata` is server-only. The page must be a server component that delegates to a client component for interactivity.
- **Counting enrollments on every catalog page load:** Use a denormalized `enrolledCount` field or cache the count to avoid N+1 queries per card.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OG image generation | Custom image rendering with canvas | Next.js `ImageResponse` from `next/og` | Built-in, handles edge rendering, flexbox CSS |
| Dynamic metadata | Manual `<head>` tag injection | `generateMetadata` function | Next.js handles merging, streaming, bot detection |
| Clipboard copy | Custom clipboard API wrapper | `navigator.clipboard.writeText()` | Native API, well-supported, project already uses toast for feedback |
| Search debounce | Custom timer logic | Simple `setTimeout`/`clearTimeout` in useEffect | 300ms debounce is standard; no library needed for one input |

**Key insight:** Next.js has first-class support for everything needed in this phase -- dynamic metadata, OG image generation, route groups for layout separation, and server/client component split. No external dependencies required.

## Common Pitfalls

### Pitfall 1: generateMetadata in Client Components
**What goes wrong:** Exporting `generateMetadata` from a `"use client"` page fails silently or throws
**Why it happens:** Metadata generation is server-only in Next.js App Router
**How to avoid:** The public course page must be a server component. Use a client component only for the interactive body.
**Warning signs:** Missing OG tags in page source, metadata not appearing in social previews

### Pitfall 2: Route Conflict Between Dashboard and Public Course Pages
**What goes wrong:** Both `app/(dashboard)/courses/[id]/page.tsx` and `app/(public)/courses/[id]/page.tsx` match the same URL `/courses/[id]`
**Why it happens:** Route groups `(dashboard)` and `(public)` don't add URL segments, so both resolve to `/courses/[id]`
**How to avoid:** Only ONE route group can own `/courses/[id]`. Options:
  - (A) Use the public route for `/courses/[id]` and handle both authenticated and unauthenticated views within it
  - (B) Keep the dashboard course page at `/courses/[id]` and add generateMetadata to it (requires making it a server component wrapper)
  - **Recommendation: Option A** -- Create a unified public-facing `/courses/[id]` page with `generateMetadata` that detects auth state and shows appropriate UI. The dashboard sidebar can link to `/courses/[id]` and the page decides what to render.
**Warning signs:** Build errors about conflicting routes, wrong layout rendering

### Pitfall 3: N+1 Enrollment Count Queries in Catalog
**What goes wrong:** Fetching enrollment count per course card means N additional DB queries for N courses
**Why it happens:** `Enrollment.getEnrollmentCount()` is called per course
**How to avoid:** Either (a) add a denormalized `enrolledCount` field on Course, updated on enroll/unenroll, or (b) use a single aggregation pipeline to get counts for all courses in one query
**Warning signs:** Slow catalog page loads, increasing response times with more courses

### Pitfall 4: isPublished vs accessLevel Migration Gap
**What goes wrong:** Existing code checks `isPublished` in many places. Adding `accessLevel` without updating all checks creates inconsistency.
**Why it happens:** `isPublished` is checked in: GET courses route, GET course/[id] route, enroll route, course permissions, and potentially frontend code
**How to avoid:**
  - Add `accessLevel` field
  - Make `isPublished` a Mongoose virtual that returns `accessLevel !== 'restricted'`
  - OR keep `isPublished` as a real field and sync it with `accessLevel` via a pre-save hook
  - Update all backend queries that filter on `isPublished` to also consider `accessLevel`
**Warning signs:** Courses appearing in catalog that shouldn't, or vice versa

### Pitfall 5: Auth Redirect Loop with Enroll Param
**What goes wrong:** After login with `?enroll=courseId`, the enrollment API call fails and user gets stuck
**Why it happens:** CSRF token not set yet, race condition between cookie set and enrollment POST, or course not found
**How to avoid:**
  - Enrollment after auth should happen client-side after the auth cookie is confirmed set
  - Handle enrollment failure gracefully (redirect to course page anyway, show toast)
  - Validate courseId format before attempting enrollment
**Warning signs:** 400/401 errors after successful login, user redirected to dashboard instead of course

### Pitfall 6: Streaming Metadata and Bot Detection
**What goes wrong:** OG tags don't appear in social media previews despite being in the page source
**Why it happens:** Next.js 16 streams metadata for dynamic pages but disables streaming for known bots. If bot detection fails, metadata may not be in the initial HTML.
**How to avoid:** Ensure `htmlLimitedBots` config includes common social crawlers. Test with `curl` to verify metadata is in initial response.
**Warning signs:** Social previews show generic site info instead of course-specific metadata

## Code Examples

### Example 1: Updated getCoursePermissions for Access Levels
```typescript
// lib/auth/coursePermissions.ts (updated)
export async function getCoursePermissions(
  course: ICourse,
  user: JWTPayload | null
): Promise<CoursePermissions> {
  if (!user) {
    const isAccessible = course.accessLevel === 'published' || course.accessLevel === 'unlisted';
    return {
      isInstructor: false,
      isEnrolled: false,
      isOwner: false,
      isAdmin: false,
      isSharedWith: false,
      canEdit: false,
      canView: isAccessible,
    };
  }

  const isInstructor = resolveId(course.instructor) === user.userId;
  const isOwner = course.owner ? resolveId(course.owner) === user.userId : false;
  const isAdmin = user.role === 'admin';
  const isSharedWith = course.sharedWith?.some(id => id.toString() === user.userId) ?? false;
  const isEnrolled = await Enrollment.isEnrolled(course._id, user.userId);

  const canEdit = isInstructor || isOwner || isAdmin;
  const isAccessible = course.accessLevel === 'published' || course.accessLevel === 'unlisted';
  const canView = canEdit || isEnrolled || isSharedWith || isAccessible;

  return { isInstructor, isEnrolled, isOwner, isAdmin, isSharedWith, canEdit, canView };
}
```

### Example 2: Explore Page Catalog API Query
```typescript
// Modified GET /api/courses for catalog mode
if (searchParams.get('catalog') === 'true') {
  query.accessLevel = 'published';
  if (user) {
    const enrolledCourseIds = await Enrollment.find({ student: user.userId }).distinct('course');
    query.instructor = { $ne: user.userId };
    query.owner = { $ne: user.userId };
    query._id = { $nin: enrolledCourseIds };
  }
  // Sort by enrollment count for social proof
  sort = { enrolledCount: -1, createdAt: -1 };
}
```

### Example 3: Public Layout with Minimal Header
```typescript
// app/(public)/layout.tsx
import Link from 'next/link';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-xl font-bold text-zinc-900 dark:text-white">
              Kantigo
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">
                Sign in
              </Link>
              <Link href="/register" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getServerSideProps` for metadata | `generateMetadata` export | Next.js 13+ (App Router) | Server components handle metadata natively |
| Custom OG image services (Cloudinary, Puppeteer) | `next/og` ImageResponse | Next.js 13+ | Built-in, no external dependency |
| `<Head>` component for meta tags | File conventions + metadata object | Next.js 13+ | Automatic `<head>` management |
| `params` as synchronous prop | `params` as Promise (await required) | Next.js 15+ | Must `await params` in generateMetadata |

**Deprecated/outdated:**
- `next/head` component: Replaced by metadata API in App Router
- `getServerSideProps` / `getStaticProps`: Not available in App Router; use server components directly

## Open Questions

1. **Route ownership for `/courses/[id]`**
   - What we know: Both dashboard and public views need to serve `/courses/[id]`. Route groups cannot overlap on the same URL path.
   - What's unclear: Whether to unify under one route group or restructure URLs
   - Recommendation: Move the course detail to `(public)` route group with `generateMetadata`, and have it detect auth state to show appropriate UI. The dashboard links to the same URL. This avoids route conflicts and enables OG metadata for all course pages. The page renders different UI based on permissions (owner sees edit tools, enrolled user sees content, visitor sees preview).

2. **Denormalized enrolledCount field**
   - What we know: Sorting by enrollment count is required for catalog. Currently enrollment counts are fetched via `Enrollment.getEnrollmentCount()` per course.
   - What's unclear: Whether to add a denormalized counter field or use aggregation
   - Recommendation: Add `enrolledCount` field to Course schema, increment/decrement atomically on enroll/unenroll. This allows efficient sorting and display without joins.

3. **Share dialog redesign scope**
   - What we know: Existing `ShareDialog` component supports email-based sharing. Needs Google Docs-style access level dropdown + copy link button.
   - What's unclear: Whether to extend or replace the existing component
   - Recommendation: Extend the existing `ShareDialog` to add the access level dropdown above the people list. Add "Copy link" button. Keep existing email sharing functionality.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.2.0 |
| Config file | `jest.config.ts` |
| Quick run command | `npm test -- --testPathPattern="catalog"` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CATL-01 | Unauthenticated user can browse published courses via API | integration | `npm test -- __tests__/integration/courses/catalog.test.ts -t "unauthenticated"` | Wave 0 |
| CATL-01 | Catalog excludes restricted and unlisted courses | integration | `npm test -- __tests__/integration/courses/catalog.test.ts -t "excludes"` | Wave 0 |
| CATL-02 | Catalog supports keyword search | integration | `npm test -- __tests__/integration/courses/catalog.test.ts -t "search"` | Wave 0 |
| CATL-03 | Auto-enrollment after auth with ?enroll param | integration | `npm test -- __tests__/integration/courses/catalog.test.ts -t "auto-enroll"` | Wave 0 |
| CATL-03 | Enroll endpoint respects accessLevel (unlisted + published allow enrollment) | integration | `npm test -- __tests__/integration/courses/enrollment.test.ts -t "accessLevel"` | Wave 0 |
| CATL-04 | generateMetadata returns correct OG tags for course | unit | `npm test -- __tests__/integration/courses/catalog.test.ts -t "metadata"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="catalog|enrollment"`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/integration/courses/catalog.test.ts` -- covers CATL-01, CATL-02, CATL-03, CATL-04
- [ ] Update `__tests__/helpers/fixtures.ts` -- add `accessLevel` support to `createTestCourse`

## Sources

### Primary (HIGH confidence)
- Official Next.js docs: [Metadata and OG Images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) - generateMetadata, ImageResponse, opengraph-image.tsx convention
- Official Next.js docs: [generateMetadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) - metadata fields, params as Promise
- Existing codebase: `app/api/courses/route.ts` - existing public listing, search, pagination
- Existing codebase: `app/api/courses/[id]/route.ts` - existing optional auth, permissions
- Existing codebase: `lib/auth/coursePermissions.ts` - getCoursePermissions pattern
- Existing codebase: `lib/models/Course.ts` - schema, indexes, isPublished field
- Existing codebase: `lib/models/Enrollment.ts` - isEnrolled, getEnrollmentCount statics
- Existing codebase: `components/course/ShareDialog.tsx` - existing share UI to extend

### Secondary (MEDIUM confidence)
- Next.js docs: [opengraph-image convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) - file-based OG image generation
- Existing codebase: `app/(dashboard)/courses/[id]/page.tsx` - 1000+ line client component, reference for what the public page needs to show (subset)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all built-in Next.js features
- Architecture: HIGH - route groups, server/client split, and metadata APIs are well-documented Next.js patterns; codebase already follows these
- Pitfalls: HIGH - route conflict risk is real and verified by understanding how route groups work; enrollment count N+1 is a known MongoDB pattern issue
- Database model: MEDIUM - `accessLevel` enum is a clean design but migration from `isPublished` needs care to avoid breaking existing queries

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable patterns, Next.js App Router is mature)
