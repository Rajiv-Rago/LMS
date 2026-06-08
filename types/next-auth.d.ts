import type { DefaultSession } from "next-auth";

type UserRole = "student" | "teacher" | "admin";
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
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    subscriptionTier?: SubscriptionTier;
  }
}
