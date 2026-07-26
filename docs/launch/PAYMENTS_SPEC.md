# Payments & Subscriptions Spec

## Goal

Let users pay for the `plus` tier. Stripe owns everything it can own — Checkout for purchase, the hosted Billing Portal for cancellation/invoices/card updates — so the app's job reduces to one checkout redirect, one webhook, and a pricing page.

Ships last (Phase 4). Free-tier soft launch does not depend on it.

## Current State

- `User.subscriptionTier: "free" | "plus" | "admin"` exists and already gates AI credits (`lib/ai/rateLimit.ts`), so the entitlement side is done.
- No Stripe integration, no customer ID on the user, no pricing page, no upgrade/cancel flow. The only way to become `plus` is a manual DB edit.
- Terms of Service (once written, see LEGAL_PAGES_SPEC.md) have no billing section.

## Target State

- A pricing page shows free vs plus; upgrading redirects to Stripe Checkout.
- Successful payment flips the user to `plus` via webhook; cancellation/expiry flips them back to `free`.
- Users manage their subscription (cancel, update card, view invoices) in the Stripe Billing Portal — no in-app billing UI.
- Terms include billing and refund policy; the refund path is manual through Stripe's dashboard at launch.

## Scope

### Model

- Add to `User`: `stripeCustomerId?: string`, `stripeSubscriptionId?: string`, `subscriptionStatus?: string` (raw Stripe status, for debugging/UI copy). `subscriptionTier` remains the single source of truth for entitlements — nothing else in the app should read the Stripe fields for gating.

### Stripe setup (dashboard, not code)

- One Product ("Kantigo Plus") with a monthly Price; optionally a yearly Price.
- Billing Portal enabled with cancellation allowed.
- Webhook endpoint registered for the events listed below.

### API routes

- `POST /api/billing/checkout` — authenticated. Creates (or reuses) the Stripe customer, stores `stripeCustomerId`, creates a Checkout Session (mode `subscription`) with `client_reference_id = userId`, returns the redirect URL. Reject if already `plus`.
- `POST /api/billing/portal` — authenticated, requires `stripeCustomerId`. Returns a Billing Portal session URL.
- `POST /api/billing/webhook` — verifies the Stripe signature (raw body, not JSON-parsed). Handles:
  - `checkout.session.completed` → set tier `plus`, store subscription ID.
  - `customer.subscription.updated` → sync status; `active`/`trialing` → `plus`, anything terminal → `free`.
  - `customer.subscription.deleted` → set tier `free`.
  - Look up the user by `stripeCustomerId` (fallback `client_reference_id`); log and 200 unknown events. Webhook handlers must be idempotent — Stripe retries.
- Never trust the success-redirect URL to grant the tier; only the webhook mutates `subscriptionTier`.

### Env

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PLUS_MONTHLY` (+ yearly if offered) added to `lib/env.ts`, required in production once payments are enabled (guard with a `PAYMENTS_ENABLED` flag so soft launch doesn't require Stripe keys).

### UI

- `app/(public)/pricing/page.tsx` — free vs plus comparison (AI credit limits from the existing tier config), upgrade CTA. Linked from landing page and the AI-credits exhausted state.
- Settings: current plan, "Upgrade" (checkout) or "Manage billing" (portal) button. No custom cancel/invoice UI.
- When a free user exhausts AI credits, the error state links to `/pricing`.

### Legal

- Add billing terms to the ToS: price, billing cycle, cancellation effective at period end, refund policy (recommend: 14-day refund on first purchase, manual via support email).

## Decisions

- Single paid tier at launch — the `User` model enum stays `free | plus | admin`. Add tiers later only if real demand appears.
- No trials at launch; the free tier is the trial.
- Tax: enable Stripe Tax if selling to the EU is intended; owner decision before go-live.

## Out of Scope

- Per-course purchases, teacher payouts, marketplace mechanics.
- Proration/seat logic, teams, coupons.
- Dunning UI — Stripe Smart Retries + portal cover failed payments.

## Acceptance Checks

- Free user completes Checkout in test mode → webhook fires → tier is `plus` → AI credit limit reflects it without re-login.
- Cancelling via the Billing Portal → at period end (or immediately with a clock-advanced test) tier returns to `free`.
- Webhook with an invalid signature is rejected 400; replaying a valid event does not double-apply.
- Success redirect without a webhook (simulate delay) does not show `plus` entitlements.
- Pricing page renders unauthenticated; upgrade CTA sends logged-out users through login first.
