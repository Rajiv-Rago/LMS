import type { NextAuthConfig } from "next-auth";
import { validateAuthSession } from "./sessionRegistry";
import { resolveOAuthSignIn } from "./oauth";

type UserRole = "student" | "teacher" | "admin";
type SubscriptionTier = "free" | "plus" | "admin";

export const authCallbacks = {
  async jwt({ token, user, account, profile }) {
    if (account?.type === "oauth") {
      const oauthUser = await resolveOAuthSignIn({ account, profile });
      if (!oauthUser) return null;

      token.id = oauthUser.id;
      token.email = oauthUser.email;
      token.name = oauthUser.name;
      token.role = oauthUser.role;
      token.subscriptionTier = oauthUser.subscriptionTier;
      token.sessionId = oauthUser.sessionId;
      return token;
    }

    if (user) {
      token.id = user.id;
      token.role = user.role;
      token.subscriptionTier = user.subscriptionTier;
      token.sessionId = user.sessionId;
    }

    if (
      typeof token.id !== "string" ||
      typeof token.sessionId !== "string" ||
      !(await validateAuthSession(token.sessionId, token.id))
    ) {
      return null;
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
