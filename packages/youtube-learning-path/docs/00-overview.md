# 00 - Production Architecture Overview

## Status: DRAFT
## Last Updated: 2026-02-21

---

## What This App Does

YouTube Learning Path Builder is an AI-powered web app that creates structured learning curriculums from YouTube videos. Users describe what they want to learn, the app searches YouTube, an LLM organizes the best videos into a progressive curriculum, and users track their progress through it.

---

## Current State (MVP)

| Area | Current | Problem |
|------|---------|---------|
| Auth | None | No user accounts, no data ownership |
| Storage | Browser localStorage | Data lost on device change, no sync |
| Database | None | Can't persist server-side |
| Payments | None | No revenue model |
| Security | Minimal | No rate limiting, no input validation, API keys in env only |
| API routes | 1 (`POST /api/generate`) | No auth middleware, no usage tracking |
| Deployment | Local dev only | No CI/CD, no monitoring |

---

## Target State (Production)

| Area | Target | Tech |
|------|--------|------|
| Auth | Google OAuth + email/password | NextAuth.js v5 |
| Storage | Server-side with cloud sync | MongoDB Atlas |
| Database | Document store | MongoDB via Mongoose |
| Payments | Free / Pro / Team tiers | Stripe Subscriptions |
| Security | Full hardening | Rate limiting, encryption, CSP, CSRF |
| API routes | 12+ endpoints | RESTful, all authenticated |
| Deployment | Production on Vercel | GitHub Actions CI/CD |

---

## Tech Stack (Final)

### Existing (Keep)
- **Next.js 15** (App Router)
- **React 19**
- **TypeScript 5.7**
- **Tailwind CSS 3.4**
- **YouTube Data API v3**
- **Groq LLM API** (llama-3.3-70b-versatile)

### Adding
- **NextAuth.js v5** (`next-auth@5`) - Authentication
- **Mongoose 8** - MongoDB ODM
- **MongoDB Atlas** - Cloud database
- **Stripe** (`stripe` + `@stripe/stripe-js`) - Payments
- **Zod** - Runtime input validation
- **Upstash Redis** (`@upstash/ratelimit`) - Rate limiting (serverless-compatible)
- **bcryptjs** - Password hashing (for email/password auth)
- **nodemailer** - Email verification & password reset

### Dev/Ops Additions
- **GitHub Actions** - CI/CD pipeline
- **Vercel Analytics** - Performance monitoring
- **Sentry** (`@sentry/nextjs`) - Error tracking

---

## New Project Structure

```
youtube-learning-path/
├── docs/                        # Spec documents (this folder)
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout (updated: session provider)
│   │   ├── page.tsx             # Landing page (public)
│   │   ├── globals.css
│   │   ├── (auth)/              # Auth route group (public)
│   │   │   ├── signin/page.tsx  # Sign in page
│   │   │   ├── signup/page.tsx  # Sign up page
│   │   │   └── verify/page.tsx  # Email verification
│   │   ├── (app)/               # Authenticated route group
│   │   │   ├── layout.tsx       # Auth check wrapper
│   │   │   ├── dashboard/page.tsx  # User dashboard (replaces /)
│   │   │   ├── create/page.tsx  # Path creation form (was /)
│   │   │   ├── path/
│   │   │   │   └── [id]/page.tsx   # Path view (was /path?id=)
│   │   │   ├── settings/page.tsx   # Account settings
│   │   │   └── billing/page.tsx    # Subscription management
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts  # NextAuth handler
│   │       ├── generate/route.ts            # Path generation (authed)
│   │       ├── paths/
│   │       │   ├── route.ts                 # GET list, POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts             # GET, DELETE path
│   │       │       └── progress/route.ts    # GET, PATCH progress
│   │       ├── user/
│   │       │   ├── route.ts                 # GET, PATCH profile
│   │       │   └── usage/route.ts           # GET usage stats
│   │       └── webhooks/
│   │           └── stripe/route.ts          # Stripe webhook handler
│   ├── components/
│   │   ├── auth/                # Auth UI components
│   │   │   ├── SignInForm.tsx
│   │   │   ├── SignUpForm.tsx
│   │   │   └── UserMenu.tsx
│   │   ├── billing/             # Billing UI components
│   │   │   ├── PricingCards.tsx
│   │   │   ├── UsageBar.tsx
│   │   │   └── SubscriptionStatus.tsx
│   │   ├── form/                # (existing, keep as-is)
│   │   ├── path/                # (existing, keep as-is)
│   │   └── ui/                  # (existing, keep as-is)
│   ├── context/
│   │   └── PathContext.tsx       # Updated: fetch from API instead of localStorage
│   ├── lib/
│   │   ├── types.ts             # Updated: add User, Subscription types
│   │   ├── youtube.ts           # (keep as-is)
│   │   ├── groq.ts              # LLM integration (renamed from openai.ts)
│   │   ├── storage.ts           # DEPRECATED: replaced by API calls
│   │   ├── db.ts                # NEW: MongoDB connection singleton (Mongoose)
│   │   ├── mongodb-client.ts    # NEW: Native MongoClient for NextAuth adapter
│   │   ├── auth.ts              # NEW: NextAuth config
│   │   ├── stripe.ts            # NEW: Stripe client + helpers
│   │   ├── rate-limit.ts        # NEW: Rate limiting config
│   │   └── validation.ts        # NEW: Zod schemas for all inputs
│   ├── models/                  # NEW: Mongoose models
│   │   ├── User.ts
│   │   ├── LearningPath.ts
│   │   ├── PathProgress.ts
│   │   └── Subscription.ts
│   └── middleware.ts            # NEW: Auth + rate limit middleware
├── .env.local                   # Environment variables (expanded)
├── .env.local.example           # Template (updated)
├── next.config.ts               # Updated: security headers
├── package.json                 # Updated: new dependencies
└── vercel.json                  # NEW: Vercel deployment config
```

---

## Environment Variables (Complete List)

```bash
# === Required ===

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/ytlearning?retryWrites=true&w=majority

# NextAuth
NEXTAUTH_URL=http://localhost:3000          # Production: https://yourdomain.com
NEXTAUTH_SECRET=<random-32-byte-hex>        # Generate: openssl rand -hex 32

# Google OAuth
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>

# Stripe
STRIPE_SECRET_KEY=sk_live_...               # Or sk_test_... for dev
STRIPE_PUBLISHABLE_KEY=pk_live_...          # Or pk_test_... for dev
STRIPE_WEBHOOK_SECRET=whsec_...             # From Stripe dashboard

# APIs
YOUTUBE_API_KEY=<your-key>
GROQ_API_KEY=gsk_...

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# === Optional ===

# Email (for email/password auth)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your@gmail.com
EMAIL_SERVER_PASSWORD=<app-password>
EMAIL_FROM=noreply@yourdomain.com

# Sentry (error tracking)
SENTRY_DSN=https://...@sentry.io/...

# Node
NODE_ENV=development
```

---

## Data Flow (Production)

```
                    ┌─────────────────────┐
                    │   Vercel (Edge/Node) │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                    │
    ┌──────▼──────┐    ┌──────▼──────┐     ┌──────▼──────┐
    │  Next.js    │    │  API Routes  │     │  Webhooks   │
    │  Pages      │    │  (authed)    │     │  (Stripe)   │
    └──────┬──────┘    └──────┬──────┘     └──────┬──────┘
           │                  │                    │
           │           ┌──────▼──────┐             │
           │           │  Middleware  │             │
           │           │  - Auth     │             │
           │           │  - Rate lim │             │
           │           │  - Validate │             │
           │           └──────┬──────┘             │
           │                  │                    │
     ┌─────▼──────────────────▼────────────────────▼─────┐
     │                   MongoDB Atlas                     │
     │  Collections: users, paths, progress, subscriptions │
     └──────────────────────┬──────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
       ┌──────▼──┐  ┌──────▼──┐  ┌──────▼──┐
       │ YouTube │  │  Groq   │  │ Stripe  │
       │ API     │  │  API    │  │  API    │
       └─────────┘  └─────────┘  └─────────┘
```

---

## Developer Roles

| Dev | Alias | Focus Areas |
|-----|-------|-------------|
| Dev A | **Auth Dev** | Authentication, user management, middleware, settings |
| Dev B | **Data Dev** | Database, API routes, migration, PathContext refactor |
| Dev C | **Billing Dev** | Stripe integration, pricing UI, usage tracking, webhooks |

All three devs share responsibility for security hardening and deployment. See `08-task-delegation.md` for the full breakdown.
