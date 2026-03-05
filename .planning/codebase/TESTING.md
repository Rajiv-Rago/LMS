# Testing Patterns

**Analysis Date:** 2026-03-05

## Test Framework

**Runner:**
- Jest 30 via `next/jest.js` wrapper
- Config: `jest.config.ts`

**Assertion Library:**
- Jest built-in `expect` + `@testing-library/jest-dom` matchers

**Run Commands:**
```bash
npm test                           # Run all tests
npm test -- path/to/file.test.ts   # Run a single test file
npm run test:watch                 # Watch mode
npm run test:coverage              # Coverage report
```

## Test Configuration

**`jest.config.ts`:**
- Uses `next/jest.js` to handle Next.js transforms
- Environment: `jest-environment-node` (not jsdom)
- Setup file: `jest.setup.ts` (loaded via `setupFilesAfterEnv`)
- Path alias: `@/*` mapped to `<rootDir>/$1`
- `forceExit: true` to handle dangling connections
- Test timeout: 15 seconds (set in `jest.setup.ts`)

**`jest.setup.ts`:**
- Imports `@testing-library/jest-dom`
- Sets default timeout to 15 seconds for integration tests (bcrypt hashing, DB setup)
- Provides fallback env vars: `JWT_SECRET`, `MONGODB_URI`, `MONGODB_URI_TEST`

## Test File Organization

**Location:** Hybrid pattern
- **Unit tests:** Co-located with source files (`lib/ai/services/syllabusGenerator.test.ts` next to `syllabusGenerator.ts`)
- **Integration tests:** Centralized in `__tests__/integration/` grouped by domain
- **Test helpers:** `__tests__/helpers/`
- **Test mocks:** `__tests__/mocks/`

**Naming:**
- All test files: `*.test.ts` (no `.spec.ts` files)
- No `.test.tsx` files currently exist

**Structure:**
```
__tests__/
  helpers/
    api.ts              # buildRequest(), parseResponse() helpers
    db.ts               # In-memory MongoDB setup/teardown
    fixtures.ts         # Factory functions for test data
  integration/
    auth/
      login.test.ts
      register.test.ts
      me.test.ts
    courses/
      crud.test.ts
      enrollment.test.ts
      ai-error-handling.test.ts
    assignments/
      crud.test.ts
      submissions.test.ts
  mocks/
    aiProvider.ts       # Mock AI provider implementation

lib/
  ai/services/syllabusGenerator.test.ts     # Co-located unit test
  ai/services/tutor.test.ts                 # Co-located unit test
  ai/services/lessonContentGenerator.test.ts
  ai/utils/providerResolver.test.ts         # Co-located unit test
  ai/utils/jsonParser.test.ts               # Co-located unit test
  auth/jwt.test.ts                          # Co-located unit test
  models/User.test.ts                       # Co-located model test
  models/Assignment.test.ts                 # Co-located model test
  models/Submission.test.ts                 # Co-located model test
  utils/quizGrader.test.ts                  # Co-located unit test
  db.test.ts                                # Placeholder (stub)
```

## Test Structure

**Suite Organization:**
```typescript
// Integration test pattern (API routes)
import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser, createTestCourse } from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import { GET, POST } from "@/app/api/courses/route";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("Courses CRUD", () => {
  describe("POST /api/courses", () => {
    it("allows a teacher to create a standard course", async () => {
      // Arrange
      const { token } = await createTestUser({ role: "teacher" });

      // Act
      const request = buildRequest("POST", "/api/courses", {
        token,
        body: { title: "My Course", description: "A great course" },
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<{
        course: { title: string };
      }>(response);

      // Assert
      expect(status).toBe(201);
      expect(data.course.title).toBe("My Course");
    });
  });
});
```

**Unit test pattern (services):**
```typescript
// Mock dependencies at top of file
const mockGenerateText = jest.fn();
jest.mock("../index", () => ({
  createAIProvider: () => ({
    name: "openai",
    chat: jest.fn(),
    generateText: mockGenerateText,
  }),
}));

describe("SyllabusGeneratorService", () => {
  let service: SyllabusGeneratorService;

  beforeEach(() => {
    mockGenerateText.mockReset();
    service = new SyllabusGeneratorService({
      provider: "openai",
      apiKey: "test-key",
    });
  });

  it("generates a valid syllabus", async () => {
    mockGenerateText.mockResolvedValue({
      content: validSyllabusJson,
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    });

    const result = await service.generateSyllabus({ /* params */ });
    expect(result.syllabus.courseTitle).toBe("Intro to TypeScript");
  });
});
```

**Patterns:**
- `beforeAll` with 30-second timeout for DB connection setup
- `afterEach` clears all collections between tests for isolation
- `afterAll` disconnects and stops in-memory server
- Arrange/Act/Assert pattern (implicit, not commented)
- Tests are descriptive: `it("returns 403 when a non-instructor tries to update")`
- Error cases tested alongside happy paths in the same describe block

## Test Database

**Framework:** `mongodb-memory-server` (in-memory MongoDB)

**Setup/Teardown (from `__tests__/helpers/db.ts`):**
```typescript
// Connects to ephemeral in-memory MongoDB
export async function connectTestDb(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
  // Patches global._mongoose so dbConnect() reuses test connection
  global._mongoose.conn = mongoose;
  global._mongoose.promise = Promise.resolve(mongoose);
}

// Clears all collections between tests
export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

// Disconnects and stops server
export async function disconnectTestDb(): Promise<void> {
  global._mongoose = { conn: null, promise: null };
  await mongoose.disconnect();
  await mongoServer.stop();
}
```

## API Test Helpers

**`__tests__/helpers/api.ts`:**
```typescript
// Build a NextRequest for direct route handler testing
export function buildRequest(
  method: string,
  path: string,
  options: { body?: Record<string, unknown>; token?: string; searchParams?: Record<string, string> } = {}
): NextRequest

// Parse response into { status, data }
export async function parseResponse<T>(response: Response): Promise<{ status: number; data: T }>
```

Key behaviors:
- Automatically sets `Content-Type: application/json`
- Adds `X-Requested-With: XMLHttpRequest` for mutation methods (CSRF)
- Adds `Authorization: Bearer` header when token provided
- Route params passed as `{ params: Promise.resolve({ id: "..." }) }` (Next.js 16 async params)

## Fixtures / Test Data Factories

**Location:** `__tests__/helpers/fixtures.ts`

**Available Factories:**
```typescript
// Creates user with JWT token, auto-incrementing email
createTestUser({ role: "teacher" }): Promise<{ user: IUser; token: string }>

// Creates course linked to instructor
createTestCourse(instructorId, { title, isPublished }): Promise<{ course: ICourse }>

// Creates module and adds it to course.modules
createTestModule(courseId, { title, order }): Promise<{ module: IModule }>

// Creates assignment with sensible defaults
createTestAssignment(courseId, { title, points, assignmentType }): Promise<{ assignment: IAssignment }>
```

**Pattern:**
- Every factory accepts `overrides: Partial<T> = {}` spread over defaults
- `createTestUser()` auto-generates unique emails via counter
- `resetFixtureCounters()` resets the counter between suites (used in some test files)
- Factories create real Mongoose documents in the test DB (not plain objects)

## Mocking

**Framework:** Jest built-in `jest.mock()`, `jest.fn()`

**Module Mocking Pattern:**
```typescript
// Mock at module level before imports
jest.mock("@/lib/ai/utils/providerResolver", () => ({
  resolveProvider: jest.fn(() => null),
}));

// Access mock in tests
const { resolveProvider } = jest.requireMock("@/lib/ai/utils/providerResolver");
resolveProvider.mockReturnValueOnce({ provider: "openai", apiKey: "sk-test" });
```

**Custom Mock Provider (`__tests__/mocks/aiProvider.ts`):**
```typescript
// Factory that implements AIProvider interface with call tracking
const mockProvider = createMockAIProvider({
  chatResponse: "Mock response text",
  shouldError: false,
});

// Usage in tests
mockProvider.reset();                    // Clear call history
expect(mockProvider.calls).toHaveLength(1);
expect(mockProvider.calls[0].method).toBe("chat");
```

**Environment Variable Mocking:**
```typescript
// Save and restore env between tests
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.OPENAI_API_KEY;
});

afterAll(() => {
  process.env = originalEnv;
});
```

**What to Mock:**
- AI provider APIs (never call real AI services)
- Queue/job systems (`lib/queue`)
- Rate limiting (`lib/ai/rateLimit`)
- Logger/error tracking (`lib/logger`)
- Environment module (`lib/env`)
- User preferences (`lib/ai/utils/userPreferences`)

**What NOT to Mock:**
- Mongoose models (use real models against in-memory MongoDB)
- Validation schemas (test real Zod validation)
- JWT signing/verification (use real implementation with test secret)
- Route handlers (import and call directly)

## Integration Test Approach

**Tests call route handlers directly** rather than making HTTP requests:
```typescript
import { POST } from "@/app/api/auth/login/route";

const request = buildRequest("POST", "/api/auth/login", {
  body: { email: "test@example.com", password: "password123" },
});
const response = await POST(request);
```

For routes with dynamic params:
```typescript
import { GET } from "@/app/api/courses/[id]/route";

const response = await GET(request, {
  params: Promise.resolve({ id: course._id.toString() }),
});
```

**Testing Checklist for API Routes:**
- Happy path with valid auth + data
- 401 for unauthenticated requests
- 403 for unauthorized role/user
- 400 for invalid input (validation)
- 404 for non-existent resources
- Authorization edge cases (instructor vs. enrolled student vs. outsider)
- Cascade effects (e.g., deleting assignment deletes submissions)

## Error Testing

**Thrown Errors:**
```typescript
await expect(
  service.generateSyllabus({ topic: "Test", targetLevel: "beginner", estimatedDuration: "1 week" })
).rejects.toThrow("missing required fields");
```

**Mongoose Validation Errors:**
```typescript
await expect(
  User.create({ email: "not-an-email", name: "Test", password: "password123" })
).rejects.toThrow("valid email");
```

**API Error Responses:**
```typescript
const { status, data } = await parseResponse<{ error: string }>(response);
expect(status).toBe(503);
expect(data.error).toBe("AI service is temporarily unavailable. Please try again later.");
```

**Leaked Information Assertions:**
```typescript
const LEAKED_PATTERNS = [
  /API key not configured/i,
  /provider.*not configured/i,
  /groq|openai|anthropic|gemini|cerebras/i,
];

function assertNoLeakedDetails(errorMessage: string) {
  for (const pattern of LEAKED_PATTERNS) {
    expect(errorMessage).not.toMatch(pattern);
  }
}
```

## Coverage

**Requirements:**
```
global:
  branches: 30%
  functions: 30%
  lines: 30%
  statements: 30%
```

**Collected From:**
- `lib/**/*.ts`
- `app/api/**/*.ts`
- Excludes: `lib/**/*.test.ts`, `lib/models/index.ts`

**View Coverage:**
```bash
npm run test:coverage
```

## Test Types

**Unit Tests (co-located):**
- AI services: `syllabusGenerator.test.ts`, `tutor.test.ts`, `lessonContentGenerator.test.ts`
- Utilities: `jsonParser.test.ts`, `providerResolver.test.ts`, `quizGrader.test.ts`
- Auth: `jwt.test.ts`
- Models: `User.test.ts`, `Assignment.test.ts`, `Submission.test.ts`
- Mock external dependencies, test against in-memory DB for model tests

**Integration Tests (`__tests__/integration/`):**
- Auth flows: login, register, session management
- Course CRUD with authorization checks
- Assignment CRUD with permission checks and cascading deletes
- Enrollment flows
- AI error handling (503 responses, leaked information checks)
- Use real Mongoose models against in-memory MongoDB

**E2E Tests:** Not used. No Playwright, Cypress, or similar framework configured.

**Component Tests:** Not used. No React component tests exist despite `@testing-library/jest-dom` being installed.

## Common Patterns

**Async Testing:**
```typescript
it("creates a user with valid data", async () => {
  const user = await User.create(validUser);
  expect(user.email).toBe("test@example.com");
});
```

**Testing Pure Functions:**
```typescript
// Use helper to build test data
function makeQuestion(overrides: Partial<IQuizQuestion> = {}): IQuizQuestion {
  return {
    id: overrides.id || "q1",
    question: overrides.question || "What is 1+1?",
    options: overrides.options || ["1", "2", "3"],
    correctAnswer: overrides.correctAnswer ?? 1,
    points: overrides.points ?? 10,
  };
}

it("grades all correct answers", () => {
  const questions = [
    makeQuestion({ id: "q1", correctAnswer: 0, points: 10 }),
  ];
  const result = gradeQuiz(questions, { q1: 0 });
  expect(result.score).toBe(10);
});
```

**Testing with Custom Mock Objects:**
```typescript
// Create mock with tracking, use in test, reset between tests
const mockProvider = createMockAIProvider({ chatResponse: "Help text" });

beforeEach(() => {
  mockProvider.reset();
  service = new AITutorService(mockProvider);
});

it("sends messages to provider", async () => {
  await service.chat([{ role: "user", content: "Hello" }], context);
  expect(mockProvider.calls).toHaveLength(1);
  expect(mockProvider.calls[0].options?.systemPrompt).toContain("course name");
});
```

**Password/Bcrypt Testing:**
```typescript
it("hashes the password on save", async () => {
  const user = await User.create(validUser);
  const userWithPassword = await User.findById(user._id).select("+password");
  expect(userWithPassword!.password).not.toBe("password123");
  expect(userWithPassword!.password).toMatch(/^\$2[aby]\$/); // bcrypt hash
});
```

---

*Testing analysis: 2026-03-05*
