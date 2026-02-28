# 04 - Security Hardening

## Status: DRAFT
## Last Updated: 2026-02-21

---

## 1. Rate Limiting

### Provider: Upstash Redis (`@upstash/ratelimit`)

Serverless-compatible rate limiting using Upstash's REST-based Redis.

```bash
npm install @upstash/ratelimit @upstash/redis
```

### File: `src/lib/rate-limit.ts`

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Different limiters for different endpoints
export const rateLimiters = {
  // Auth: 5 attempts per 15 minutes per IP
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "rl:auth",
  }),

  // Path generation: 10 requests per hour per user
  generate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:generate",
  }),

  // General API: 100 requests per minute per user
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    prefix: "rl:api",
  }),

  // Signup: 3 accounts per hour per IP
  signup: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    prefix: "rl:signup",
  }),
};
```

### Usage in API Routes

```typescript
import { rateLimiters } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Use IP for unauthenticated endpoints, userId for authenticated
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const { success, remaining, reset } = await rateLimiters.auth.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    );
  }

  // ... handle request
}
```

### Rate Limit Summary

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /api/auth/signup` | 3 | 1 hour | IP |
| `POST /api/auth/signin` | 5 | 15 min | IP |
| `POST /api/auth/forgot-password` | 3 | 1 hour | IP |
| `POST /api/generate` | 10 | 1 hour | User ID |
| `POST /api/billing/*` | 5 | 1 min | User ID |
| All other `GET /api/*` | 100 | 1 min | User ID |
| All other `POST /api/*` | 30 | 1 min | User ID |

---

## 2. Input Validation (Zod)

```bash
npm install zod
```

### File: `src/lib/validation.ts`

Every API input must be validated with Zod before processing.

```typescript
import { z } from "zod";

// ─── Auth Schemas ───

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").toLowerCase().trim(),
  password: z
    .string()
    .min(8, "Minimum 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain a number"),
});

export const signInSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});

// ─── Path Generation Schema ───

export const generatePathSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(1, "Topic is required")
    .max(200, "Topic too long")
    .regex(/^[a-zA-Z0-9\s\-\+\#\.\,\/\(\)]+$/, "Topic contains invalid characters"),
  skillLevel: z.enum([
    "complete_beginner",
    "some_basics",
    "intermediate",
    "advanced",
  ]),
  learningGoal: z.string().trim().min(1).max(1000),
  videoLengths: z
    .array(z.enum(["short", "medium", "long", "any"]))
    .min(1, "Select at least one"),
  teachingStyles: z
    .array(
      z.enum([
        "straight_to_point",
        "detailed",
        "project_based",
        "theory_focused",
        "visual_animated",
        "code_along",
      ])
    )
    .min(1),
  creatorTypes: z
    .array(
      z.enum(["professional", "self_taught", "university", "any_credible"])
    )
    .min(1),
  hoursPerWeek: z.enum(["2-3", "3-5", "5-10", "10+"]),
  timeline: z.enum([
    "1_week",
    "2_weeks",
    "1_month",
    "2-3_months",
    "no_rush",
  ]),
  excludeFilters: z.array(
    z.enum(["outdated", "clickbait", "low_quality", "non_english"])
  ),
  includeFilters: z.array(
    z.enum(["exercises", "projects", "quizzes", "resources"])
  ),
});

// ─── Progress Update Schema ───

export const updateVideoProgressSchema = z.object({
  videoId: z.string().min(1).max(20),
  status: z.enum(["unwatched", "watching", "watched", "skipped"]),
});

export const updateNotesSchema = z.object({
  videoId: z.string().min(1).max(20),
  notes: z.string().max(10000),
});

export const toggleCheckSchema = z.object({
  moduleId: z.string().min(1).max(20),
  index: z.number().int().min(0).max(50),
});

// ─── Billing Schema ───

export const checkoutSchema = z.object({
  priceId: z.string().startsWith("price_"),
  seats: z.number().int().min(1).max(20).default(1),
});

// ─── Helper: Validate and return typed data or error response ───

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.errors[0];
    return {
      success: false,
      error: `${firstError.path.join(".")}: ${firstError.message}`,
    };
  }
  return { success: true, data: result.data };
}
```

### Usage in API Routes

```typescript
import { generatePathSchema, validateBody } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json();
  const validation = validateBody(generatePathSchema, body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  const formData = validation.data;
  // formData is now fully typed and validated
}
```

---

## 3. Security Headers

### File: `next.config.ts` (update)

```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // XSS protection (legacy browsers)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Referrer policy
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Permissions policy
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Strict Transport Security (HTTPS only)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://i.ytimg.com https://img.youtube.com https://lh3.googleusercontent.com https://*.stripe.com",
              "font-src 'self'",
              "connect-src 'self' https://api.stripe.com https://vitals.vercel-insights.com",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  // ... existing config
};
```

---

## 4. API Key Protection

### Rules

1. **YouTube API key** and **Groq API key** are ONLY used server-side in API routes. They must NEVER be sent to the client. Prefix with nothing (no `NEXT_PUBLIC_`).

2. **Stripe publishable key** is the ONLY key that goes to the client. It's designed for this. Use `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

3. **All secrets** live in `.env.local` (local) and Vercel environment variables (production). Never commit them.

### `.gitignore` Verification

Ensure these are present:
```
.env
.env.local
.env.*.local
```

---

## 5. MongoDB Security

### Connection String
- Use `mongodb+srv://` (TLS enabled by default)
- Database user: `readWrite` role only on `ytlearning` database
- Network access: Restrict to Vercel IPs in production

### Query Safety
- Always use Mongoose models (parameterized queries, no raw string interpolation)
- Never pass user input directly into `$where`, `$regex` without escaping
- Use `lean()` for read queries (returns plain objects, no Mongoose methods)

### Sensitive Fields
- Never return `hashedPassword` in API responses
- Always use `.select("-hashedPassword")` or explicit field selection

```typescript
// CORRECT:
const user = await User.findById(id).select("name email tier image").lean();

// WRONG:
const user = await User.findById(id); // includes hashedPassword
```

---

## 6. CSRF Protection

NextAuth v5 handles CSRF automatically for:
- OAuth sign-in (state parameter)
- Credentials sign-in (CSRF token)
- Sign-out

For custom POST endpoints, rely on:
1. **Same-origin policy** + session cookies (SameSite=Lax)
2. **Verify Origin header** matches expected domain for sensitive mutations

```typescript
// Optional: Add to sensitive endpoints
function verifyOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const expected = process.env.NEXTAUTH_URL;
  if (!origin || !expected) return false;
  return new URL(origin).origin === new URL(expected).origin;
}
```

---

## 7. Stripe Webhook Security

- Always verify webhook signature using `stripe.webhooks.constructEvent()`
- Use the raw request body (not parsed JSON) for signature verification
- The webhook endpoint (`/api/webhooks/stripe`) must be excluded from auth middleware
- Log failed signature verifications for monitoring

---

## 8. Password Security

- Hash with **bcryptjs**, **12 salt rounds**
- Never store or log plaintext passwords
- Never return password hashes in API responses
- Password reset tokens: SHA-256 hashed in database, 1-hour expiry

---

## 9. Error Handling

### Rules
1. Never expose internal error details, stack traces, or database errors to clients
2. Log detailed errors server-side (Sentry + console)
3. Return generic error messages to clients

```typescript
// CORRECT:
catch (error) {
  console.error("Generate path error:", error);
  Sentry.captureException(error);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}

// WRONG:
catch (error) {
  return NextResponse.json(
    { error: error.message, stack: error.stack },
    { status: 500 }
  );
}
```

---

## 10. Dependency Security

- Run `npm audit` before every deployment
- Keep dependencies updated monthly
- Pin exact versions in `package.json` for production stability
- Review changelogs for major version bumps before updating

---

## Security Checklist (Pre-Launch)

- [ ] All API routes validate input with Zod
- [ ] All authenticated routes check session
- [ ] Rate limiting active on all endpoints
- [ ] Security headers configured in `next.config.ts`
- [ ] Stripe webhook signature verification working
- [ ] No API keys exposed to client (check Network tab)
- [ ] `hashedPassword` never returned in API responses
- [ ] MongoDB network access restricted
- [ ] `.env.local` in `.gitignore`
- [ ] `npm audit` shows 0 critical/high vulnerabilities
- [ ] HTTPS enforced (Vercel handles this)
- [ ] Error responses don't leak internal details
- [ ] Password reset tokens expire after 1 hour
- [ ] Sentry configured for error monitoring
