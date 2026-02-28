# 07 - Deployment (Vercel + CI/CD)

## Status: DRAFT
## Last Updated: 2026-02-21

---

## Hosting: Vercel

### Why Vercel
- Native Next.js support (zero config)
- Serverless functions for API routes
- Edge middleware support
- Built-in SSL, CDN, preview deployments
- Free tier sufficient for early launch

---

## Vercel Project Setup

### 1. Connect GitHub Repository

1. Go to [vercel.com](https://vercel.com) → "Add New Project"
2. Import the `youtube-learning-path` GitHub repository
3. Framework preset: Next.js (auto-detected)
4. Root directory: `./` (default)
5. Build command: `npm run build` (default)
6. Output directory: `.next` (default)

### 2. Environment Variables

Set ALL of these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Value | Environments |
|----------|-------|-------------|
| `MONGODB_URI` | `mongodb+srv://...` | Production, Preview |
| `NEXTAUTH_URL` | `https://yourdomain.com` | Production |
| `NEXTAUTH_URL` | `https://$VERCEL_URL` | Preview |
| `NEXTAUTH_SECRET` | `<32-byte-hex>` | Production, Preview |
| `GOOGLE_CLIENT_ID` | `<from-google-console>` | Production, Preview |
| `GOOGLE_CLIENT_SECRET` | `<from-google-console>` | Production, Preview |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Production |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Preview |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Production |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | Preview |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Production |
| `STRIPE_PRO_PRICE_ID` | `price_...` | Production, Preview |
| `STRIPE_TEAM_PRICE_ID` | `price_...` | Production, Preview |
| `YOUTUBE_API_KEY` | `AIza...` | Production, Preview |
| `GROQ_API_KEY` | `gsk_...` | Production, Preview |
| `UPSTASH_REDIS_REST_URL` | `https://...` | Production, Preview |
| `UPSTASH_REDIS_REST_TOKEN` | `...` | Production, Preview |
| `EMAIL_SERVER_HOST` | `smtp.gmail.com` | Production |
| `EMAIL_SERVER_PORT` | `587` | Production |
| `EMAIL_SERVER_USER` | `your@gmail.com` | Production |
| `EMAIL_SERVER_PASSWORD` | `<app-password>` | Production |
| `EMAIL_FROM` | `noreply@yourdomain.com` | Production |
| `SENTRY_DSN` | `https://...@sentry.io/...` | Production, Preview |

### 3. Domain Configuration

1. Vercel Dashboard → Settings → Domains
2. Add custom domain (e.g., `learnpath.app`)
3. Update DNS records as instructed by Vercel
4. Update `NEXTAUTH_URL` to match the custom domain
5. Update Google OAuth redirect URIs to include the custom domain

---

## Vercel Configuration

### File: `vercel.json`

```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/generate/route.ts": {
      "maxDuration": 60
    },
    "src/app/api/webhooks/stripe/route.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
```

Notes:
- `regions: ["iad1"]` = US East (match MongoDB Atlas region)
- `maxDuration: 60` for generate route because YouTube search + Groq API can be slow
- API routes set `no-store` to prevent caching of authenticated data

---

## CI/CD Pipeline

### GitHub Actions Workflow

### File: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Build
        run: npm run build
        env:
          # Provide dummy values so build doesn't fail on missing env vars
          MONGODB_URI: mongodb://localhost:27017/test
          NEXTAUTH_URL: http://localhost:3000
          NEXTAUTH_SECRET: dummy-secret-for-build
          GOOGLE_CLIENT_ID: dummy
          GOOGLE_CLIENT_SECRET: dummy
          YOUTUBE_API_KEY: dummy
          GROQ_API_KEY: dummy
          STRIPE_SECRET_KEY: sk_test_dummy
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_test_dummy
          UPSTASH_REDIS_REST_URL: https://dummy.upstash.io
          UPSTASH_REDIS_REST_TOKEN: dummy
```

### Branch Strategy

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production | Vercel production (custom domain) |
| `dev` | Staging/integration | Vercel preview URL |
| `feature/*` | Feature branches | Vercel preview URL (per-PR) |

### PR Workflow
1. Dev creates `feature/xxx` branch from `dev`
2. Opens PR to `dev`
3. CI runs lint + typecheck + build
4. Vercel creates preview deployment
5. Code review + test on preview URL
6. Merge to `dev`
7. When ready for release, merge `dev` → `main`

---

## Monitoring

### Sentry (Error Tracking)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

This auto-creates:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- Updates `next.config.ts` with Sentry webpack plugin

### Vercel Analytics (Performance)

```bash
npm install @vercel/analytics
```

Add to `layout.tsx`:
```typescript
import { Analytics } from "@vercel/analytics/react";

// In the JSX:
<Analytics />
```

### Health Check

The landing page (`/`) serves as a basic health check. For a dedicated health endpoint:

```typescript
// src/app/api/health/route.ts
import { connectDB } from "@/lib/db";

export async function GET() {
  try {
    await connectDB();
    return Response.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    return Response.json({ status: "error" }, { status: 500 });
  }
}
```

---

## Deployment Checklist (Pre-Launch)

### Infrastructure
- [ ] MongoDB Atlas cluster created and configured
- [ ] Upstash Redis instance created
- [ ] Vercel project connected to GitHub repo
- [ ] Custom domain configured with SSL
- [ ] All environment variables set in Vercel

### Stripe
- [ ] Products and prices created in Stripe Dashboard (live mode)
- [ ] Webhook endpoint registered: `https://yourdomain.com/api/webhooks/stripe`
- [ ] Webhook events selected: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`
- [ ] Customer Portal configured in Stripe Dashboard

### Google OAuth
- [ ] Google Cloud project created
- [ ] OAuth consent screen configured (external, published)
- [ ] OAuth 2.0 credentials created
- [ ] Authorized redirect URI: `https://yourdomain.com/api/auth/callback/google`
- [ ] Authorized JavaScript origin: `https://yourdomain.com`

### Security
- [ ] `npm audit` clean
- [ ] All security headers verified (use securityheaders.com)
- [ ] Rate limiting tested
- [ ] No API keys in client bundle (check with Vercel → Source tab)

### Monitoring
- [ ] Sentry configured and receiving test events
- [ ] Vercel Analytics enabled
- [ ] Health endpoint responding

---

## Cost Estimates (Monthly)

| Service | Free Tier | Expected Cost (1K users) |
|---------|-----------|-------------------------|
| Vercel (Hobby) | 100GB bandwidth | $0 |
| Vercel (Pro) | If needed | $20/mo |
| MongoDB Atlas (M0) | 512MB storage | $0 |
| MongoDB Atlas (M10) | If needed | $57/mo |
| Upstash Redis | 10K commands/day | $0 |
| Stripe | 2.9% + $0.30 per transaction | Variable |
| Sentry (Developer) | 5K events/mo | $0 |
| Google OAuth | Free | $0 |
| YouTube API | 10K units/day | $0 |
| Groq API | Depends on usage | ~$10-50/mo |
| Custom domain | Annual | ~$12/yr |

**Minimum viable cost: $0-12/mo** (all free tiers)
**At 1K active users: ~$80-130/mo**
