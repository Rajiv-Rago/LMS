import type { DefaultSession } from "next-auth";

type UserRole = "user" | "admin";
type SubscriptionTier = "free" | "plus" | "admin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      subscriptionTier: SubscriptionTier;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    subscriptionTier: SubscriptionTier;
    sessionId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    subscriptionTier?: SubscriptionTier;
    sessionId?: string;
  }
}
