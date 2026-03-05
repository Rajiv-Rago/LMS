# Coding Conventions

**Analysis Date:** 2026-03-05

## Naming Patterns

**Files:**
- Mongoose models: PascalCase (`User.ts`, `Course.ts`, `AIChatSession.ts`) in `lib/models/`
- AI providers: lowercase provider name (`openai.ts`, `anthropic.ts`, `gemini.ts`) in `lib/ai/providers/`
- Services: camelCase (`syllabusGenerator.ts`, `lessonContentGenerator.ts`, `tutor.ts`) in `lib/ai/services/`
- Validation schemas: camelCase with "Schemas" suffix (`authSchemas.ts`, `aiSchemas.ts`, `youtubeSchemas.ts`) in `lib/validation/`
- Utilities: camelCase (`quizGrader.ts`, `pagination.ts`, `providerResolver.ts`)
- React components: PascalCase (`ModelSelector.tsx`, `QuizTimer.tsx`, `Toast.tsx`)
- Route handlers: always `route.ts` (Next.js App Router convention)
- Test files: co-located with source, named `*.test.ts` (e.g., `syllabusGenerator.test.ts` next to `syllabusGenerator.ts`)
- Integration tests: in `__tests__/integration/` grouped by domain (`auth/`, `courses/`, `assignments/`)

**Functions:**
- camelCase for all functions: `createAIProvider()`, `parsePagination()`, `gradeQuiz()`
- Async route handlers: named exports matching HTTP methods in UPPERCASE: `GET`, `POST`, `PATCH`, `DELETE`
- Factory/builder functions: `create*` prefix (`createAIProvider()`, `createTestUser()`, `createMockAIProvider()`)
- Boolean check functions: `is*` or `can*` prefix (`isLocked()`, `canModifyOwnedCourse()`, `isAttemptValid()`)
- Getter functions: `get*` prefix (`getApiKey()`, `getConnectionStatus()`, `getDefaultProvider()`)

**Variables:**
- camelCase for all variables and constants: `rateLimitMap`, `cachedConfig`, `validSyllabusJson`
- UPPER_SNAKE_CASE for module-level constants: `DEFAULT_MODEL`, `SYLLABUS_SYSTEM_PROMPT`, `CACHE_TTL_MS`, `RATE_LIMIT_CONFIG`
- Boolean variables: `is*` or `has*` prefix (`isPublished`, `isInstructor`, `isAdmin`)

**Types/Interfaces:**
- Interfaces: `I` prefix for Mongoose document interfaces (`IUser`, `ICourse`, `IModule`, `IAssignment`)
- No `I` prefix for non-Mongoose interfaces (`JWTPayload`, `AIProvider`, `SyllabusRequest`, `TutorContext`)
- Type aliases: PascalCase without prefix (`SyllabusStatus`, `AIProviderName`, `SubmissionType`)
- Props interfaces: PascalCase with `Props` suffix (`ModelSelectorProps`)
- Result/return interfaces: PascalCase with `Result` suffix (`CourseOwnershipResult`, `TestUserResult`)

## Code Style

**Formatting:**
- No explicit Prettier config detected; ESLint handles formatting via `eslint-config-next`
- 2-space indentation (consistent across all files)
- Double quotes for strings in TypeScript
- Trailing commas in multi-line objects/arrays
- Semicolons at end of statements

**Linting:**
- ESLint 9 with flat config in `eslint.config.mjs`
- Uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Packages directory (`packages/**`) is globally ignored from linting
- TypeScript strict mode enabled in `tsconfig.json`

## Import Organization

**Order:**
1. Node built-ins (`crypto`)
2. External packages (`next/server`, `mongoose`, `zod`, `jsonwebtoken`)
3. Internal absolute imports using `@/` alias (`@/lib/db`, `@/lib/models`, `@/lib/auth`)
4. Relative imports (only in tests and within the same module)

**Path Aliases:**
- `@/*` maps to project root (used everywhere for lib, app, components imports)
- `@youtube-core/*` maps to `packages/youtube-learning-path/src/core/*` (used only in `lib/youtube/`)

**Import Style:**
- Named imports preferred: `import { dbConnect } from "@/lib/db"`
- Default imports for Mongoose models: `import User from "@/lib/models/User"`
- Barrel exports via `index.ts` in `lib/models/`, `lib/auth/`, `lib/ai/`
- Type-only imports used where appropriate: `import type { AITier } from "@/lib/ai/types"`

## Error Handling

**API Route Pattern (standard for all routes):**
```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. CSRF check for mutations
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    // 2. Authentication
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Validation with Zod
    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    // 4. Database operation
    await dbConnect();
    // ... business logic ...

    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    captureException(error, { operation: "Descriptive operation name" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Key patterns:**
- Every route handler is wrapped in try/catch
- Catch blocks always call `captureException(error, { operation: "..." })` from `lib/logger.ts`
- User-facing errors are generic ("Internal server error", "Something went wrong. Please try again later.")
- Internal details are never leaked to users (provider names, stack traces, connection errors)
- Zod validation uses `.safeParse()` and returns the first issue message
- Auth errors return 401, authorization errors return 403, not-found returns 404
- AI service unavailability returns 503 with "AI service is temporarily unavailable. Please try again later."

**Service/Library Error Handling:**
- Services throw errors that route handlers catch: `throw new Error("Invalid syllabus structure: missing required fields")`
- Custom error classes for domain-specific errors: `DatabaseConnectionError` in `lib/db.ts`
- `verifyToken()` returns `null` on failure rather than throwing

## Logging

**Framework:** Custom logger in `lib/logger.ts` wrapping console + Axiom

**Patterns:**
- Use `captureException(error, context)` for error tracking in catch blocks
- Use `logger.info()`, `logger.warn()`, `logger.error()` for structured logging
- Context is always a `Record<string, unknown>` object
- Production logs are JSON-serialized; development logs are human-readable
- Always include an `operation` key in error context: `captureException(error, { operation: "Login error" })`

## Comments

**When to Comment:**
- Comments are minimal; code is self-documenting
- JSDoc used for public API functions with non-obvious behavior (e.g., `decodeToken()` has a WARNING comment)
- Inline comments for security-critical logic: "Atomic increment to prevent TOCTOU race condition"
- `// eslint-disable-next-line` used sparingly with specific rule names

**Section Separators (in test files):**
```typescript
// -- Mocks --
// -- Setup --
// -- Helpers --
// -- Tests --
```

## Function Design

**Size:** Functions are focused and small. Route handlers are the largest units, typically under 60 lines.

**Parameters:**
- Use options objects with defaults: `parsePagination(request, { limit: 10 })`
- Factory functions accept `overrides: Partial<T> = {}` for flexible defaults
- Spread defaults with overrides: `{ ...defaults, ...overrides }`

**Return Values:**
- API routes always return `NextResponse.json()` with explicit status codes
- Auth functions return `null` on failure (not exceptions): `authenticate()` returns `JWTPayload | null`
- Ownership checks return structured result objects: `{ allowed: boolean; reason?: string; course?: Course }`
- Utility functions return explicit types, not `any`

## Module Design

**Exports:**
- Barrel files (`index.ts`) re-export from subdirectories in `lib/models/`, `lib/auth/`, `lib/ai/`
- Default exports for Mongoose models: `export default Course`
- Named exports for everything else: services, utilities, types, constants
- Types are re-exported alongside values: `export type { ICourse } from "./Course"`

**Barrel Files:**
- `lib/models/index.ts`: Re-exports all models and their types
- `lib/auth/index.ts`: Re-exports JWT, middleware, course ownership functions
- `lib/ai/index.ts`: Re-exports providers, types, utilities, factory functions

**Mongoose Model Pattern:**
```typescript
// 1. Import mongoose
import mongoose, { Document, Model } from "mongoose";

// 2. Define TypeScript interface extending Document
export interface ICourse extends Document {
  title: string;
  // ...
}

// 3. Define schema with validation messages
const courseSchema = new mongoose.Schema<ICourse>({
  title: {
    type: String,
    required: [true, "Course title is required"],
    trim: true,
  },
});

// 4. Add indexes
courseSchema.index({ instructor: 1 });

// 5. Prevent model recompilation
const Course =
  (mongoose.models.Course as CourseModel) ||
  mongoose.model<ICourse, CourseModel>("Course", courseSchema);

export default Course;
```

## Validation

**Framework:** Zod 4

**Patterns:**
- Schemas defined in `lib/validation/` or co-located at the top of route files
- Inline schemas for simple route-specific validation (see `createCourseSchema` in `app/api/courses/route.ts`)
- Shared schemas in `lib/validation/` for reuse (`authSchemas.ts`, `aiSchemas.ts`, `commonSchemas.ts`)
- Type inference from schemas: `export type LoginInput = z.infer<typeof loginSchema>`
- Environment validation via Zod in `lib/env.ts` with early fail at startup
- Use `.refine()` for cross-field validation rules

## Authentication / Authorization

**Pattern:**
- `authenticate(request)` returns `JWTPayload | null` (no throw)
- `requireAuth()` HOF wraps handler, returns 401 if unauthenticated
- `requireRole(...roles)` HOF wraps handler, returns 401/403 based on role
- `requireCsrf(request)` checks `X-Requested-With: XMLHttpRequest` for mutations
- Token extracted from `Authorization: Bearer` header OR `token` cookie
- Route params in Next.js 16 are async: `const { id } = await params`

## React Component Conventions

**Client Components:**
- Must start with `"use client"` directive
- Use named function exports: `export function ModelSelector()`
- Props destructured in function signature with defaults: `{ value, onChange, disabled, className = "" }`
- Inline interfaces for props (not separate files)
- Tailwind CSS classes directly in JSX, no CSS modules
- Dark mode via Tailwind `dark:` variants
- Loading states use skeleton/shimmer patterns (`animate-pulse`)

**Hooks:**
- Custom hooks in `lib/hooks/` with `use` prefix: `useToast.ts`, `useConfirm.ts`, `useJobPoller.ts`

---

*Convention analysis: 2026-03-05*
