import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { NextRequest } from "next/server";
import { authCallbacks } from "@/lib/auth/authjsCallbacks";
import { authorizeCredentials } from "@/lib/auth/credentials";

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
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET || process.env.JWT_SECRET,
  callbacks: authCallbacks,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
