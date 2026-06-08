import type { NextAuthConfig } from "next-auth";

type UserRole = "student" | "teacher" | "admin";
type SubscriptionTier = "free" | "plus" | "admin";

export const authCallbacks = {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.role = user.role;
      token.subscriptionTier = user.subscriptionTier;
    }

    return token;
  },
  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id as string;
      session.user.role = token.role as UserRole;
      session.user.subscriptionTier = token.subscriptionTier as SubscriptionTier;
    }

    return session;
  },
} satisfies NextAuthConfig["callbacks"];
