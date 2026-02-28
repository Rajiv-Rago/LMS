# 08 - Task Delegation (3 Full-Stack Devs)

## Status: DRAFT
## Last Updated: 2026-02-21

---

## Team Structure

| Dev | Alias | Primary Focus | Secondary |
|-----|-------|---------------|-----------|
| Dev A | **Auth Dev** | Authentication, users, middleware | Settings page, security headers |
| Dev B | **Data Dev** | Database, API routes, migration | PathContext refactor, routing |
| Dev C | **Billing Dev** | Stripe, pricing, usage | Billing UI, upgrade prompts |

---

## Phase 1: Foundation (Week 1-2)

All three devs work in parallel on independent workstreams.

### Dev A — Authentication

| # | Task | Est. | Spec Ref | Acceptance Criteria |
|---|------|------|----------|-------------------|
| A1 | Install dependencies: `next-auth@5`, `@auth/mongodb-adapter`, `bcryptjs`, `nodemailer`, `zod` | 0.5h | `02-authentication.md` | `npm install` succeeds, no type errors |
| A2 | Create `src/lib/auth.ts` — NextAuth config with Google + Credentials providers | 3h | `02-authentication.md` → "NextAuth Configuration" | Google OAuth flow works end-to-end on localhost. Credentials authorize function validates against DB. |
| A3 | Create `src/app/api/auth/[...nextauth]/route.ts` — handler | 0.5h | `02-authentication.md` → "API Route Handler" | `/api/auth/providers` returns Google + Credentials |
| A4 | Create `src/types/next-auth.d.ts` — session type augmentation | 0.5h | `02-authentication.md` → "Type Augmentation" | `session.user.id` and `session.user.tier` exist with no TS errors |
| A5 | Create `src/middleware.ts` — route protection | 2h | `02-authentication.md` → "Middleware" | Unauthenticated users redirected from `/dashboard`, `/create`, `/path/*`, `/settings`, `/billing`. API routes return 401. Auth pages redirect to `/dashboard` if logged in. |
| A6 | Create `POST /api/auth/signup` — email/password signup | 2h | `05-api-design.md` → "POST /api/auth/signup" | Creates user in DB with hashed password. Returns 409 if email exists. Validates with Zod `signUpSchema`. |
| A7 | Create `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` | 3h | `05-api-design.md` → "forgot-password" and "reset-password" | Token generated, hashed, stored with 1hr expiry. Email sent via nodemailer. Reset validates token and updates password. Always returns 200 on forgot (no email leak). |
| A8 | Create sign-in page at `src/app/(auth)/signin/page.tsx` | 3h | None (UI task) | Google button + email/password form. Error display. "Forgot password?" link. Redirect to `/dashboard` on success. |
| A9 | Create sign-up page at `src/app/(auth)/signup/page.tsx` | 2h | None (UI task) | Name + email + password form with validation. "Already have an account?" link. Calls `/api/auth/signup` then auto-signs in. |
| A10 | Create `UserMenu` component (header) | 1.5h | None (UI task) | Shows avatar + name when signed in. Dropdown: Dashboard, Settings, Billing, Sign Out. Shows Sign In / Sign Up when not authenticated. |
| A11 | Update `src/app/layout.tsx` — wrap in `SessionProvider` | 0.5h | `02-authentication.md` → "Session Provider Setup" | `useSession()` works in all client components |
| A12 | Create settings page at `src/app/(app)/settings/page.tsx` | 2h | None (UI task) | Display name (editable), email (read-only), auth provider, account created date. "Change Password" section (only for credentials users). |

**Dev A Total: ~20.5 hours**

---

### Dev B — Database & API Routes

| # | Task | Est. | Spec Ref | Acceptance Criteria |
|---|------|------|----------|-------------------|
| B1 | Install dependencies: `mongoose` | 0.5h | `01-database.md` | No type errors after install |
| B2 | Create `src/lib/db.ts` — MongoDB connection singleton | 1h | `01-database.md` → "Connection Setup" | `connectDB()` reuses connections. Works in serverless (Vercel). |
| B3 | Create `src/models/User.ts` — User Mongoose model | 1.5h | `01-database.md` → "users" collection | Schema matches spec exactly. Indexes created. `hashedPassword` field exists but is excluded from default queries. |
| B4 | Create `src/models/LearningPath.ts` — LearningPath model | 1.5h | `01-database.md` → "learning_paths" collection | Schema matches spec. `userId` ref + index. Text index on `summary.topic`. |
| B5 | Create `src/models/PathProgress.ts` — PathProgress model | 1.5h | `01-database.md` → "path_progress" collection | Schema matches spec. Unique compound index on `userId` + `pathId`. Map types for `videoProgress` and `moduleChecks`. |
| B6 | Create `GET /api/paths` — list user's paths | 1.5h | `05-api-design.md` → "GET /api/paths" | Returns array of path summaries for authenticated user. Sorted by `createdAt` desc. Only returns `_id`, `summary`, `createdAt`, `updatedAt`. |
| B7 | Create `GET /api/paths/:id` — get full path | 1.5h | `05-api-design.md` → "GET /api/paths/:id" | Returns full path document. 404 if not found or not owned by user. |
| B8 | Create `DELETE /api/paths/:id` — delete path | 1h | `05-api-design.md` → "DELETE /api/paths/:id" | Deletes path AND associated progress. 404 if not found or not owned. |
| B9 | Create `GET /api/paths/:id/progress` — get progress | 1h | `05-api-design.md` → "GET /api/paths/:id/progress" | Returns progress document. 404 if not found. |
| B10 | Create `PATCH /api/paths/:id/progress` — update progress | 3h | `05-api-design.md` → "PATCH /api/paths/:id/progress" | Handles all 6 action types: `video_status`, `update_notes`, `add_timestamp`, `toggle_check`, `complete_project`, `switch_variant`. Validates each with Zod. Updates streak logic. |
| B11 | Update `POST /api/generate` — add auth + DB persistence | 3h | `06-migration-plan.md` → "Step 4" | Requires auth. Saves path to MongoDB. Creates initial progress doc. Increments `pathsGeneratedThisMonth`. Returns saved doc with `_id`. |
| B12 | Refactor `PathContext.tsx` — API calls instead of localStorage | 4h | `06-migration-plan.md` → "Step 2" | All 10 methods (`refreshPaths`, `setCurrentPath`, `generatePath`, `markVideoStatus`, `updateNotes`, `addTimestamp`, `toggleCheck`, `switchVariant`, `completeProject`, `removePath`) use `fetch()` to API routes instead of `storage.*`. Loading states work. Errors propagate. |
| B13 | Update routing: `/path?id=` → `/path/[id]` | 1.5h | `06-migration-plan.md` → "Step 3" | New file at `src/app/(app)/path/[id]/page.tsx`. Uses `params.id` instead of `searchParams`. All internal links updated. Old route removed. |
| B14 | Create `POST /api/paths/import` — localStorage import | 2h | `06-migration-plan.md` → "Step 5" | Accepts legacy localStorage format. Creates path + progress docs. Maps old IDs to new ObjectIds. Max 10 paths. |
| B15 | Create import banner component | 1.5h | `06-migration-plan.md` → "Step 5" | Shows on dashboard if localStorage has data. "Import X paths" button. Clears localStorage after success. Dismissible. |
| B16 | Create `GET /api/user` + `PATCH /api/user` | 1.5h | `05-api-design.md` → "GET /api/user" and "PATCH /api/user" | GET returns user profile without `hashedPassword`. PATCH updates `name` only. Validates with Zod. |
| B17 | Create `GET /api/user/usage` | 1h | `05-api-design.md` → "GET /api/user/usage" | Returns tier, counts, limits, period dates. |
| B18 | Create dashboard page at `src/app/(app)/dashboard/page.tsx` | 3h | None (UI task) | Lists all user's paths as cards. Shows overall stats (total paths, videos watched, streak). "Create New Path" button. Import banner if applicable. |

**Dev B Total: ~31 hours**

---

### Dev C — Billing & Stripe

| # | Task | Est. | Spec Ref | Acceptance Criteria |
|---|------|------|----------|-------------------|
| C1 | Install dependencies: `stripe`, `@stripe/stripe-js` | 0.5h | `03-pricing-billing.md` | No type errors |
| C2 | Create Stripe products + prices in Stripe Dashboard | 1h | `03-pricing-billing.md` → "Stripe Product Configuration" | Pro ($10/mo) and Team ($22/mo/seat) products exist in test mode. Price IDs recorded in env vars. |
| C3 | Create `src/lib/stripe.ts` — Stripe client + `TIER_LIMITS` | 1h | `03-pricing-billing.md` → "Stripe Client Setup" | `stripe` instance exported. `TIER_LIMITS` object exported with correct limits per tier. |
| C4 | Create `POST /api/billing/checkout` | 2h | `05-api-design.md` → "POST /api/billing/checkout" | Creates Stripe Checkout session. Creates Stripe customer if doesn't exist. Validates `priceId` against known prices. Returns checkout URL. |
| C5 | Create `POST /api/billing/portal` | 1h | `05-api-design.md` → "POST /api/billing/portal" | Creates Stripe Customer Portal session. Returns portal URL. 400 if no Stripe customer. |
| C6 | Create `POST /api/webhooks/stripe` — webhook handler | 4h | `03-pricing-billing.md` → "Webhook Handler" | Verifies signature. Handles: `checkout.session.completed` (upgrade tier), `customer.subscription.updated` (tier change), `customer.subscription.deleted` (downgrade to free), `invoice.payment_failed` (log warning), `invoice.paid` (reset monthly counter). All events update the correct user document. |
| C7 | Configure Stripe Customer Portal in Dashboard | 0.5h | `03-pricing-billing.md` → "Customer Portal" | Portal allows: update payment, cancel subscription, view invoices. Configured in Stripe Dashboard settings. |
| C8 | Add usage enforcement to `POST /api/generate` | 2h | `03-pricing-billing.md` → "Usage Enforcement" | Check path count limit. Check monthly generation limit. Reset monthly counter if billing period expired. Return `403` with `PATH_LIMIT` or `GENERATION_LIMIT` code. This hooks into Dev B's updated generate route. |
| C9 | Create billing page at `src/app/(app)/billing/page.tsx` | 4h | `03-pricing-billing.md` → "Billing Page" | Shows current plan name + price. Usage bar (X/Y generations). 3-column pricing comparison table. "Upgrade" button → checkout. "Manage Subscription" button → portal. |
| C10 | Create `PricingCards` component | 2h | None (UI task) | 3-tier pricing cards (Free / Pro / Team). Highlights current plan. Feature comparison list. CTA buttons. Responsive. |
| C11 | Create `UsageBar` component | 1h | None (UI task) | Progress bar showing "X of Y generations used". Color changes at 80% and 100%. |
| C12 | Create `UpgradePrompt` component | 1h | None (UI task) | Small inline prompt shown where gated features would appear. "Unlock [Feature] with Pro" + upgrade link. |
| C13 | Add feature gating to path page | 2h | `03-pricing-billing.md` → "Feature Gating in UI" | Free users: only "standard" variant. No study schedule. No supplementary resources. Show `UpgradePrompt` instead. Check `session.user.tier` for gating. |
| C14 | Create `SubscriptionStatus` component (for settings page) | 1h | None (UI task) | Shows tier badge, renewal date, manage link. Used in both settings and billing pages. |

**Dev C Total: ~22 hours**

---

## Phase 2: Security & Integration (Week 2-3)

After Phase 1 is merged, all devs collaborate on hardening.

### Dev A — Security

| # | Task | Est. | Spec Ref |
|---|------|------|----------|
| A13 | Install `@upstash/ratelimit` + `@upstash/redis` | 0.5h | `04-security.md` |
| A14 | Create `src/lib/rate-limit.ts` — rate limiter definitions | 1h | `04-security.md` → "Rate Limiting" |
| A15 | Add rate limiting to ALL API routes | 3h | `04-security.md` → "Rate Limit Summary" |
| A16 | Add security headers to `next.config.ts` | 1h | `04-security.md` → "Security Headers" |
| A17 | Audit all API routes: no `hashedPassword` leaks, proper error messages | 1.5h | `04-security.md` → "Error Handling" |

### Dev B — Validation

| # | Task | Est. | Spec Ref |
|---|------|------|----------|
| B19 | Create `src/lib/validation.ts` — all Zod schemas | 2h | `04-security.md` → "Input Validation" |
| B20 | Add Zod validation to ALL POST/PATCH routes | 2h | `04-security.md` |
| B21 | Add proper error response shape to all routes | 1h | `05-api-design.md` → "Conventions" |

### Dev C — Testing & Webhook Hardening

| # | Task | Est. | Spec Ref |
|---|------|------|----------|
| C15 | Test full Stripe flow end-to-end with test cards | 2h | `03-pricing-billing.md` → "Testing" |
| C16 | Test webhook handler with Stripe CLI `stripe listen` | 2h | `03-pricing-billing.md` → "Webhook Testing" |
| C17 | Test all upgrade → downgrade → re-upgrade paths | 1h | — |

---

## Phase 3: Deployment & Polish (Week 3-4)

### Shared Tasks

| # | Task | Owner | Est. | Spec Ref |
|---|------|-------|------|----------|
| S1 | Set up Vercel project + connect GitHub | Any | 1h | `07-deployment.md` |
| S2 | Configure all env vars in Vercel | Any | 0.5h | `07-deployment.md` → "Environment Variables" |
| S3 | Create `.github/workflows/ci.yml` | Dev A | 1h | `07-deployment.md` → "CI/CD" |
| S4 | Set up MongoDB Atlas production cluster | Dev B | 1h | `01-database.md` → "Atlas Configuration" |
| S5 | Set up Upstash Redis | Dev A | 0.5h | `04-security.md` |
| S6 | Configure Google OAuth for production domain | Dev A | 1h | `07-deployment.md` → "Google OAuth" |
| S7 | Register Stripe webhook for production URL | Dev C | 0.5h | `07-deployment.md` → "Stripe" |
| S8 | Set up Sentry error tracking | Dev B | 1h | `07-deployment.md` → "Sentry" |
| S9 | Create `vercel.json` | Dev B | 0.5h | `07-deployment.md` → "Vercel Configuration" |
| S10 | Create `GET /api/health` | Dev B | 0.5h | `07-deployment.md` → "Health Check" |
| S11 | Run security checklist | All | 2h | `04-security.md` → "Security Checklist" |
| S12 | Update `.env.local.example` with all new variables | Any | 0.5h | `00-overview.md` → "Environment Variables" |
| S13 | Custom domain setup | Any | 0.5h | `07-deployment.md` → "Domain" |

---

## Dependency Graph

```
Phase 1 (parallel):
  Dev A: [A1-A12] ──────────────────────┐
  Dev B: [B1-B5] → [B6-B11] → [B12-B18]├──► Phase 2 → Phase 3
  Dev C: [C1-C3] → [C4-C7] → [C8-C14] ─┘

Key dependencies:
  - B3 (User model) blocks A2 (NextAuth config)
  - B11 (generate route update) blocks C8 (usage enforcement)
  - A2 (auth config) blocks B6-B11 (all API routes need auth)
  - A5 (middleware) blocks B12 (PathContext needs auth context)
```

### Suggested Order
1. **Dev B starts first**: creates models (B1-B5) since auth and billing depend on User model
2. **Dev A starts after B3**: needs User model for NextAuth adapter
3. **Dev C starts after B3**: needs User model for Stripe customer ID

---

## Total Estimates

| Phase | Dev A | Dev B | Dev C | Total |
|-------|-------|-------|-------|-------|
| Phase 1 | 20.5h | 31h | 22h | 73.5h |
| Phase 2 | 7h | 5h | 5h | 17h |
| Phase 3 | 4h | 4.5h | 1h | 9.5h |
| **Total** | **31.5h** | **40.5h** | **28h** | **100h** |

At ~6 productive hours/day: **~4 weeks for the full team**.
