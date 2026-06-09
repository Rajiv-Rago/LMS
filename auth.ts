import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { NextRequest } from "next/server";
import { authCallbacks } from "@/lib/auth/authjsCallbacks";
import { authorizeCredentials } from "@/lib/auth/credentials";
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  revokeAuthSession,
} from "@/lib/auth/sessionRegistry";

export const authConfig = {
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize(credentials, request) {
        return authorizeCredentials(credentials, request as NextRequest);
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: AUTH_SESSION_MAX_AGE_SECONDS },
  secret: process.env.AUTH_SECRET || process.env.JWT_SECRET,
  callbacks: authCallbacks,
  events: {
    async signOut(message) {
      if ("token" in message && typeof message.token?.sessionId === "string") {
        await revokeAuthSession(message.token.sessionId);
      }
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
