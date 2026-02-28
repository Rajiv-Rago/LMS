# 03 - Pricing & Billing (Stripe)

## Status: DRAFT
## Last Updated: 2026-02-21

---

## Pricing Tiers

| Feature | Free | Pro ($10/mo) | Team ($22/mo per seat) |
|---------|------|-------------|----------------------|
| Learning paths | 2 total | Unlimited | Unlimited |
| Path generations / month | 3 | 30 | 50 per seat |
| Video tracking | Yes | Yes | Yes |
| Notes & timestamps | Yes | Yes | Yes |
| Path variants (Fast/Standard/Deep) | Standard only | All 3 | All 3 |
| Study schedule | No | Yes | Yes |
| Supplementary resources | No | Yes | Yes |
| Priority AI generation | No | Yes (faster model/more tokens) | Yes |
| Export path to PDF/Markdown | No | Yes | Yes |
| Team shared paths | No | No | Yes |
| Team member management | No | No | Yes (up to 20 seats) |
| Support | Community | Email (48h) | Email (24h) |

---

## Stripe Product Configuration

### Products to Create in Stripe Dashboard

**Product 1: Pro Plan**
- Name: `Pro Plan`
- Description: `Unlimited learning paths with all features`
- Price ID: Will be auto-generated (store as `STRIPE_PRO_PRICE_ID`)
- Price: $10.00 / month (recurring)
- Billing: Monthly
- Metadata:
  - `tier`: `pro`
  - `path_limit`: `unlimited`
  - `generation_limit`: `30`

**Product 2: Team Plan**
- Name: `Team Plan`
- Description: `Collaborative learning paths for teams`
- Price ID: Will be auto-generated (store as `STRIPE_TEAM_PRICE_ID`)
- Price: $22.00 / month / seat (recurring, per-seat)
- Billing: Monthly
- Metadata:
  - `tier`: `team`
  - `path_limit`: `unlimited`
  - `generation_limit`: `50`

---

## Stripe Environment Variables

```bash
STRIPE_SECRET_KEY=sk_test_...                # Backend API calls
STRIPE_PUBLISHABLE_KEY=pk_test_...           # Frontend Checkout
STRIPE_WEBHOOK_SECRET=whsec_...              # Webhook signature verification
STRIPE_PRO_PRICE_ID=price_...                # Pro plan monthly price
STRIPE_TEAM_PRICE_ID=price_...               # Team plan per-seat price
```

---

## Dependencies

```bash
npm install stripe @stripe/stripe-js
```

---

## Stripe Client Setup

### File: `src/lib/stripe.ts`

```typescript
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

// Tier limits (single source of truth)
export const TIER_LIMITS = {
  free: {
    maxPaths: 2,
    generationsPerMonth: 3,
    variants: ["standard"] as const,
    hasSchedule: false,
    hasResources: false,
    hasExport: false,
  },
  pro: {
    maxPaths: Infinity,
    generationsPerMonth: 30,
    variants: ["fast_track", "standard", "deep_dive"] as const,
    hasSchedule: true,
    hasResources: true,
    hasExport: true,
  },
  team: {
    maxPaths: Infinity,
    generationsPerMonth: 50,  // per seat
    variants: ["fast_track", "standard", "deep_dive"] as const,
    hasSchedule: true,
    hasResources: true,
    hasExport: true,
  },
} as const;

export type Tier = keyof typeof TIER_LIMITS;
```

---

## Checkout Flow

### 1. User Clicks "Upgrade to Pro" or "Upgrade to Team"

Client calls:
```
POST /api/billing/checkout
Content-Type: application/json

{
  "priceId": "price_xxx",      // Pro or Team price ID
  "seats": 1                   // Only relevant for Team (default 1)
}
```

### 2. API Creates Stripe Checkout Session

```typescript
// POST /api/billing/checkout
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const { priceId, seats = 1 } = await req.json();

  // Validate priceId is one of our known prices
  const validPrices = [
    process.env.STRIPE_PRO_PRICE_ID,
    process.env.STRIPE_TEAM_PRICE_ID,
  ];
  if (!validPrices.includes(priceId)) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findById(session.user.id);
  if (!user) return notFound();

  // Get or create Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user._id.toString() },
    });
    customerId = customer.id;
    user.stripeCustomerId = customerId;
    await user.save();
  }

  // Create checkout session
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{
      price: priceId,
      quantity: seats,
    }],
    success_url: `${process.env.NEXTAUTH_URL}/billing?success=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/billing?canceled=true`,
    metadata: {
      userId: user._id.toString(),
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
```

### 3. Client Redirects to Stripe

```typescript
const res = await fetch("/api/billing/checkout", {
  method: "POST",
  body: JSON.stringify({ priceId: STRIPE_PRO_PRICE_ID }),
});
const { url } = await res.json();
window.location.href = url;
```

### 4. User Completes Payment on Stripe → Webhook Fires

---

## Customer Portal (Manage Subscription)

### API Route: `POST /api/billing/portal`

Creates a Stripe Customer Portal session so users can:
- Update payment method
- Cancel subscription
- Change plan
- View invoices

```typescript
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  await connectDB();
  const user = await User.findById(session.user.id);
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account" }, { status: 400 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXTAUTH_URL}/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
```

---

## Webhook Handler

### File: `src/app/api/webhooks/stripe/route.ts`

This endpoint receives events from Stripe and updates user tiers accordingly.

**Important:** This route must NOT use the auth middleware (it's called by Stripe, not a user).

```typescript
import { stripe } from "@/lib/stripe";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { headers } from "next/headers";

// Disable body parsing — Stripe needs the raw body for signature verification
export const config = { api: { bodyParser: false } };

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  await connectDB();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const subscriptionId = session.subscription as string;

      if (!userId) break;

      // Fetch subscription to get price metadata
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price.id;
      const tier = priceId === process.env.STRIPE_TEAM_PRICE_ID ? "team" : "pro";

      await User.findByIdAndUpdate(userId, {
        tier,
        stripeSubscriptionId: subscriptionId,
        pathsGeneratedThisMonth: 0,
        usagePeriodStart: new Date(),
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;
      const status = subscription.status;

      // If subscription is still active, update tier
      if (status === "active") {
        const priceId = subscription.items.data[0]?.price.id;
        const tier = priceId === process.env.STRIPE_TEAM_PRICE_ID ? "team" : "pro";
        await User.findOneAndUpdate(
          { stripeCustomerId: customerId },
          { tier, stripeSubscriptionId: subscription.id }
        );
      }
      break;
    }

    case "customer.subscription.deleted": {
      // Subscription canceled or expired
      const subscription = event.data.object;
      const customerId = subscription.customer as string;

      await User.findOneAndUpdate(
        { stripeCustomerId: customerId },
        {
          tier: "free",
          stripeSubscriptionId: null,
        }
      );
      break;
    }

    case "invoice.payment_failed": {
      // Payment failed — could notify user, but don't downgrade yet
      // Stripe will retry. Only downgrade on subscription.deleted.
      const invoice = event.data.object;
      console.warn(`Payment failed for customer ${invoice.customer}`);
      break;
    }
  }

  return new Response("OK", { status: 200 });
}
```

### Required Webhook Events (Configure in Stripe Dashboard)

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.paid`

---

## Usage Enforcement

### At Path Generation Time (`POST /api/generate`)

Before generating a path, check:

```typescript
import { TIER_LIMITS } from "@/lib/stripe";

// 1. Check total path count
const pathCount = await LearningPath.countDocuments({ userId });
const limit = TIER_LIMITS[user.tier].maxPaths;
if (pathCount >= limit) {
  return NextResponse.json(
    { error: `Free plan allows ${limit} paths. Upgrade to create more.`, code: "PATH_LIMIT" },
    { status: 403 }
  );
}

// 2. Check monthly generation count
if (user.pathsGeneratedThisMonth >= TIER_LIMITS[user.tier].generationsPerMonth) {
  return NextResponse.json(
    { error: "Monthly generation limit reached. Upgrade or wait for next billing cycle.", code: "GENERATION_LIMIT" },
    { status: 403 }
  );
}

// 3. After successful generation, increment counter
await User.findByIdAndUpdate(userId, {
  $inc: { pathsGeneratedThisMonth: 1 },
});
```

### Monthly Counter Reset

When the billing period resets, Stripe sends `invoice.paid`. Handle it:

```typescript
case "invoice.paid": {
  const invoice = event.data.object;
  const customerId = invoice.customer as string;
  await User.findOneAndUpdate(
    { stripeCustomerId: customerId },
    {
      pathsGeneratedThisMonth: 0,
      usagePeriodStart: new Date(),
    }
  );
  break;
}
```

For free users (no Stripe events), reset monthly via a cron job or on-demand check:

```typescript
// In the generation route, before checking limits:
const periodAge = Date.now() - new Date(user.usagePeriodStart).getTime();
const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
if (periodAge > ONE_MONTH) {
  user.pathsGeneratedThisMonth = 0;
  user.usagePeriodStart = new Date();
  await user.save();
}
```

---

## Feature Gating in UI

### Pattern: Check tier before rendering gated features

```typescript
// In any component that needs tier checks:
const { data: session } = useSession();
const tier = session?.user?.tier || "free";

// Gate variant switcher
{TIER_LIMITS[tier].variants.length > 1 && (
  <AlternativePaths ... />
)}

// Gate study schedule
{TIER_LIMITS[tier].hasSchedule && (
  <StudySchedule ... />
)}

// Show upgrade prompt for gated features
{!TIER_LIMITS[tier].hasSchedule && (
  <UpgradePrompt feature="Study Schedule" />
)}
```

---

## Billing Page (`/billing`)

### What It Shows

| Section | Content |
|---------|---------|
| Current Plan | Tier name, price, next billing date |
| Usage | `X / Y` paths generated this month (progress bar) |
| Plan Comparison | 3-column pricing table (Free, Pro, Team) |
| Actions | "Upgrade" / "Manage Subscription" / "Cancel" buttons |

### Actions
- **Upgrade**: Calls `POST /api/billing/checkout` → redirects to Stripe Checkout
- **Manage**: Calls `POST /api/billing/portal` → redirects to Stripe Customer Portal
- **Cancel**: Via Stripe Customer Portal (not a custom endpoint)

---

## Testing

### Stripe Test Mode

Use test API keys (`sk_test_`, `pk_test_`) during development.

### Test Card Numbers
- **Success**: `4242 4242 4242 4242`
- **Requires auth**: `4000 0025 0000 3155`
- **Declined**: `4000 0000 0000 0002`

### Webhook Testing (Local Dev)
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# This prints a webhook signing secret — use it as STRIPE_WEBHOOK_SECRET locally
```
