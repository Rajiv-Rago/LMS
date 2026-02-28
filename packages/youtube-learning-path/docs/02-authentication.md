# 02 - Authentication (NextAuth.js v5)

## Status: DRAFT
## Last Updated: 2026-02-21

---

## Overview

- **Library**: NextAuth.js v5 (`next-auth@5`)
- **Providers**: Google OAuth + Email/Password (credentials)
- **Session Strategy**: JWT (stateless, no session DB lookups on every request)
- **Database Adapter**: MongoDB adapter (`@auth/mongodb-adapter`)

---

## Dependencies to Install

```bash
npm install next-auth@5 @auth/mongodb-adapter bcryptjs nodemailer
npm install -D @types/bcryptjs @types/nodemailer
```

---

## NextAuth Configuration

### File: `src/lib/mongodb-client.ts`

The NextAuth MongoDB adapter requires a native `MongoClient` promise (not Mongoose). This is separate from the Mongoose `connectDB()` in `db.ts`.

```typescript
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not set");
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // Reuse client in dev to avoid multiple connections during HMR
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };
  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
}

export default clientPromise;
```

---

### File: `src/lib/auth.ts`

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb-client";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }, // 7 days
  pages: {
    signIn: "/signin",
    error: "/signin",       // Redirect auth errors to sign in
    verifyRequest: "/verify", // Email verification page
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true, // Allow linking if same email exists
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const user = await User.findOne({ email: credentials.email });
        if (!user || !user.hashedPassword) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        );
        if (!isValid) return null;

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign-in, load user data into token
      if (user) {
        token.id = user.id;
        await connectDB();
        const dbUser = await User.findById(user.id).select("tier").lean();
        token.tier = dbUser?.tier || "free";
      }
      // On explicit session update (triggered after Stripe webhook changes tier),
      // refresh tier from DB. Call update() client-side to trigger this.
      if (trigger === "update") {
        await connectDB();
        const dbUser = await User.findById(token.id).select("tier").lean();
        if (dbUser) {
          token.tier = dbUser.tier;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Expose user ID and tier in client session
      if (token) {
        session.user.id = token.id as string;
        session.user.tier = token.tier as string;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // Update last login timestamp
      await connectDB();
      await User.findByIdAndUpdate(user.id, { lastLoginAt: new Date() });
    },
  },
});
```

---

## Type Augmentation

### File: `src/types/next-auth.d.ts`

```typescript
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image: string | null;
      tier: "free" | "pro" | "team";
    };
  }

  interface User {
    tier?: "free" | "pro" | "team";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tier: string;
  }
}
```

---

## API Route Handler

### File: `src/app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

---

## Middleware (Route Protection)

### File: `src/middleware.ts`

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/dashboard",
  "/create",
  "/path",
  "/settings",
  "/billing",
];

// Routes that should redirect to dashboard if already authenticated
const AUTH_ROUTES = ["/signin", "/signup"];

// API routes that require authentication (exclude webhooks)
const PROTECTED_API_ROUTES = [
  "/api/generate",
  "/api/paths",
  "/api/user",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  // Protect app routes
  if (PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!isLoggedIn) {
      const signInUrl = new URL("/signin", req.nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Redirect logged-in users away from auth pages
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
    }
  }

  // Protect API routes (return 401 instead of redirect)
  if (PROTECTED_API_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

---

## Sign Up Flow (Email/Password)

### API Route: `POST /api/auth/signup`

This is a custom route (not part of NextAuth) for creating accounts with email/password.

```
POST /api/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "MinimumEightChars1!"
}
```

**Validation Rules:**
- `name`: Required, 1-100 characters, trimmed
- `email`: Required, valid email format, lowercase, unique
- `password`: Required, minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number

**Response (201 Created):**
```json
{
  "message": "Account created. Please sign in."
}
```

**Error Responses:**
- `400`: Validation failed (with specific field errors)
- `409`: Email already registered
- `500`: Server error

**Implementation:**
1. Validate input with Zod schema
2. Check if email already exists in `users` collection
3. Hash password with `bcryptjs` (12 salt rounds)
4. Create user document with `tier: "free"`, `provider: "credentials"`
5. Return success (user must sign in separately)

---

## Sign In Flow

### Google OAuth
1. User clicks "Sign in with Google" button
2. Redirects to `GET /api/auth/signin/google`
3. Google consent screen
4. Callback to `/api/auth/callback/google`
5. NextAuth creates/links user, creates JWT
6. Redirect to `/dashboard`

### Email/Password
1. User enters email + password on `/signin`
2. Client calls `signIn("credentials", { email, password })`
3. NextAuth calls `authorize()` in credentials provider
4. If valid → JWT created → redirect to `/dashboard`
5. If invalid → error shown on sign-in page

---

## Session Access

### Server Components
```typescript
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  // session.user.id, session.user.tier, etc.
}
```

### Client Components
```typescript
"use client";
import { useSession } from "next-auth/react";

export function UserMenu() {
  const { data: session, status } = useSession();
  // status: "loading" | "authenticated" | "unauthenticated"
}
```

### API Routes
```typescript
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  // ...
}
```

---

## Session Provider Setup

### File: `src/app/layout.tsx` (update)

Wrap the app in `SessionProvider`:

```typescript
import { SessionProvider } from "next-auth/react";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <PathProvider>
            {children}
          </PathProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

## Password Reset Flow

### Step 1: Request Reset
```
POST /api/auth/forgot-password
{ "email": "user@example.com" }
```
- Generate a random token (32 bytes hex)
- Hash it and store in `users.resetToken` + `users.resetTokenExpiry` (1 hour)
- Send email via nodemailer with link: `https://yourdomain.com/reset-password?token=<raw-token>`
- Always return `200` (don't reveal if email exists)

### Step 2: Reset Password
```
POST /api/auth/reset-password
{ "token": "<raw-token>", "password": "NewPassword1!" }
```
- Hash the incoming token, find user with matching `resetToken` and non-expired `resetTokenExpiry`
- Hash new password, update `hashedPassword`, clear `resetToken` fields
- Return `200` on success

---

## Security Considerations

1. **Password hashing**: bcryptjs with 12 salt rounds
2. **JWT secret**: 32-byte random hex in `NEXTAUTH_SECRET`
3. **CSRF protection**: Built into NextAuth (state parameter in OAuth, CSRF tokens for credentials)
4. **Rate limiting**: Sign-in and sign-up endpoints rate limited (see `04-security.md`)
5. **Account linking**: `allowDangerousEmailAccountLinking` enabled — if a user signs up with email then later signs in with Google using the same email, accounts are linked. This is a **conscious tradeoff**: the theoretical risk is that an attacker controlling a Google account with the victim's email could take over the account. In practice, Google verifies email ownership, making this attack very difficult. For a learning path app (low-value target), the UX benefit of seamless linking outweighs the risk. Revisit this decision if the app ever handles sensitive financial or personal data beyond Stripe billing.
6. **Session expiry**: 7 days. No refresh tokens for credentials (user re-authenticates).
