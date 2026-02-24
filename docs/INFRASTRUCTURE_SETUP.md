# Infrastructure Setup Guide

This document explains how to complete the scaffolded email notification service and distributed rate limiting. Both systems ship with zero-dependency defaults (console logger / in-memory store) and can be upgraded to production backends by setting environment variables and installing one dependency.

---

## 1. Email Notification Service

### Architecture

```
lib/email/
├── index.ts            # sendEmail() entry point, provider resolution
├── types.ts            # EmailProvider interface, shared types
├── templates.ts        # Transactional email templates
└── providers/
    ├── console.ts      # Default: logs to console (no dependency)
    ├── sendgrid.ts     # SendGrid provider (requires @sendgrid/mail)
    ├── ses.ts          # AWS SES provider (requires @aws-sdk/client-ses)
    └── resend.ts       # Resend provider (requires resend)
```

### How It Works

- `sendEmail()` in `lib/email/index.ts` resolves the provider from `EMAIL_PROVIDER` env var
- Default is `"console"` — emails are logged, not sent
- Provider instances are cached as singletons
- Templates in `lib/email/templates.ts` return `{ subject, text, html }` objects
- The forgot-password route (`app/api/auth/forgot-password/route.ts`) is already wired up

### Option A: SendGrid

**Install:**
```bash
npm install @sendgrid/mail
```

**Environment variables:**
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=LMS
APP_URL=https://yourdomain.com
```

**SendGrid setup:**
1. Create a SendGrid account at https://sendgrid.com
2. Go to Settings → API Keys → Create API Key (restricted to "Mail Send" permission)
3. Verify your sender identity (either single sender or domain authentication)
4. Copy the API key into `SENDGRID_API_KEY`

### Option B: AWS SES

**Install:**
```bash
npm install @aws-sdk/client-ses
```

**Environment variables:**
```env
EMAIL_PROVIDER=ses
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
AWS_REGION=us-east-1

# If not using IAM roles / instance profiles:
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**SES setup:**
1. Open the AWS SES console
2. Verify the sender email address or domain under "Verified identities"
3. If your account is in sandbox mode, you can only send to verified addresses — request production access
4. Create an IAM user/role with `ses:SendEmail` permission
5. If running on EC2/ECS/Lambda, prefer IAM roles over access keys

### Option C: Resend

**Install:**
```bash
npm install resend
```

**Environment variables:**
```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM_ADDRESS=LMS <noreply@yourdomain.com>
APP_URL=https://yourdomain.com
```

**Resend setup:**
1. Create an account at https://resend.com
2. Add and verify your domain in the Resend dashboard
3. Create an API key and copy it into `RESEND_API_KEY`

### Adding a Custom Provider

Implement the `EmailProvider` interface from `lib/email/types.ts`:

```typescript
import type { EmailProvider, EmailMessage, SendResult } from "../types";

export class MyProvider implements EmailProvider {
  readonly name = "my-provider";

  async send(message: EmailMessage): Promise<SendResult> {
    // Your implementation here
    return { success: true, messageId: "..." };
  }
}
```

Then add a case in `lib/email/index.ts` → `resolveProvider()` and extend the `EmailProviderName` type.

### Testing Emails Locally

With the default `console` provider, emails are logged to stdout. You'll see:
```
[Email] Message logged (console provider) { to: "user@example.com", subject: "LMS — Reset your password" }
```

For local testing with a real inbox, you can use:
- [Mailtrap](https://mailtrap.io) — SMTP capture service
- [MailHog](https://github.com/mailhog/MailHog) — local SMTP server with web UI

---

## 2. Distributed Rate Limiting

### Architecture

```
lib/rateLimit/
├── index.ts            # checkRateLimit() entry point, store resolution
├── types.ts            # RateLimitStore interface, shared types
└── stores/
    ├── memory.ts       # Default: in-memory Map (no dependency)
    └── redis.ts        # Redis store (requires ioredis)
```

### How It Works

- `checkRateLimit(ip, path)` in `lib/rateLimit/index.ts` is the drop-in replacement for the old inline rate limiter
- The middleware (`middleware.ts`) already imports and uses it
- Rate limit rules are defined in `RATE_LIMIT_RULES` in `lib/rateLimit/index.ts`
- Default store is `"memory"` — works identically to the previous implementation
- Store instances are cached as singletons

### Current Limitations (Memory Store)

- **Not shared across instances** — each server process has its own counter
- **Lost on restart** — counters reset when the process restarts
- **Fine for:** single-instance deployments, development, testing

### Upgrading to Redis

**Install:**
```bash
npm install ioredis
```

**Environment variables:**
```env
RATE_LIMIT_STORE=redis
REDIS_URL=redis://localhost:6379
```

**Redis setup options:**

| Option | Best for | Setup |
|--------|----------|-------|
| **Local Redis** | Development | `brew install redis` or `docker run -p 6379:6379 redis:7-alpine` |
| **AWS ElastiCache** | Production (AWS) | Create a Redis cluster in ElastiCache, use the primary endpoint |
| **Upstash** | Serverless | Create a database at https://upstash.com, use the REST/Redis URL |
| **Redis Cloud** | Production (any) | Create an instance at https://redis.com/cloud |

**Redis connection string formats:**
```env
# Local / standard
REDIS_URL=redis://localhost:6379

# With password
REDIS_URL=redis://:yourpassword@hostname:6379

# TLS (AWS ElastiCache, Upstash, etc.)
REDIS_URL=rediss://:yourpassword@hostname:6380
```

### How the Redis Store Works

- Each rate limit entry is stored as a Redis key: `rl:{ip}:{path}`
- Uses `INCR` for atomic counter increments
- TTL is set on key creation so Redis handles expiration natively
- No manual cleanup needed (unlike the memory store)
- Pipeline used for `INCR` + `TTL` in a single round-trip

### Adding Rate Limit Rules

Edit `RATE_LIMIT_RULES` in `lib/rateLimit/index.ts`:

```typescript
export const RATE_LIMIT_RULES: Record<string, RateLimitConfig> = {
  "/api/auth/login":           { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
  "/api/auth/register":        { maxAttempts: 5,  windowMs: 60 * 60 * 1000 },
  "/api/auth/forgot-password": { maxAttempts: 5,  windowMs: 15 * 60 * 1000 },
  // Add new rules here:
  "/api/some/endpoint":        { maxAttempts: 30, windowMs: 60 * 1000 },
};
```

### Adding a Custom Store

Implement the `RateLimitStore` interface from `lib/rateLimit/types.ts`:

```typescript
import type { RateLimitStore, RateLimitConfig, RateLimitCheckResult } from "../types";

export class MyStore implements RateLimitStore {
  readonly name = "my-store";

  async increment(key: string, config: RateLimitConfig): Promise<RateLimitCheckResult> {
    // Your implementation
  }

  async reset(key: string): Promise<void> {
    // Your implementation
  }
}
```

Then add a case in `lib/rateLimit/index.ts` → `resolveStore()`.

---

## Environment Variable Summary

### Email (pick one provider)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_PROVIDER` | No | `"console"` | `console`, `sendgrid`, `ses`, or `resend` |
| `EMAIL_FROM_ADDRESS` | When using a real provider | — | Verified sender email |
| `EMAIL_FROM_NAME` | No | `"LMS"` | Display name for sender |
| `SENDGRID_API_KEY` | When `sendgrid` | — | SendGrid API key |
| `RESEND_API_KEY` | When `resend` | — | Resend API key |
| `AWS_REGION` | When `ses` | `"us-east-1"` | AWS region |
| `AWS_ACCESS_KEY_ID` | When `ses` (no IAM role) | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | When `ses` (no IAM role) | — | AWS secret key |
| `APP_URL` | Recommended | `"http://localhost:3000"` | Base URL for email links |
| `APP_NAME` | No | `"LMS"` | App name in email templates |

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_STORE` | No | `"memory"` | `memory` or `redis` |
| `REDIS_URL` | When `redis` | — | Redis connection string |

---

## Verification

### Email

1. Set `EMAIL_PROVIDER` to your chosen provider
2. Set the required API keys
3. Trigger a password reset via the UI or API:
   ```bash
   curl -X POST http://localhost:3000/api/auth/forgot-password \
     -H "Content-Type: application/json" \
     -H "X-Requested-With: XMLHttpRequest" \
     -d '{"email": "test@example.com"}'
   ```
4. Check your inbox (or console output for `console` provider)

### Rate Limiting

1. Set `RATE_LIMIT_STORE=redis` and `REDIS_URL`
2. Restart the server
3. Verify the log: `Rate limit store initialized: redis`
4. Test by hitting the login endpoint repeatedly:
   ```bash
   for i in $(seq 1 12); do
     curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/auth/login \
       -H "Content-Type: application/json" \
       -H "X-Requested-With: XMLHttpRequest" \
       -d '{"email": "test@example.com", "password": "wrong"}'
     echo " (attempt $i)"
   done
   ```
   Attempts 11+ should return `429`.
