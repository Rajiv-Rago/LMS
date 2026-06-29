import { NextRequest, NextResponse } from "next/server";
import type { JWT } from "next-auth/jwt";
import { JWTPayload } from "./types";
import { dbConnect } from "@/lib/db";
import User, { IUser } from "@/lib/models/User";
import { validateAuthSession } from "./sessionRegistry";

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const AUTHJS_SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

type UserRole = JWTPayload["role"];
type SubscriptionTier = JWTPayload["subscriptionTier"];

export function requireCsrf(request: NextRequest): NextResponse | null {
  if (!MUTATION_METHODS.has(request.method)) return null;

  const xRequestedWith = request.headers.get("x-requested-with");
  if (xRequestedWith !== "XMLHttpRequest") {
    return NextResponse.json(
      { error: "Missing or invalid CSRF header" },
      { status: 403 }
    );
  }
  return null;
}

export async function authenticate(
  request: NextRequest
): Promise<JWTPayload | null> {
  const authJsToken = await getAuthJsSessionToken(request);
  if (!authJsToken) return null;

  return getActiveUserPayload(authJsToken);
}

async function getAuthJsSessionToken(request: NextRequest): Promise<JWT | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !hasAuthJsSessionCookie(request)) return null;

  const { getToken } = await import("next-auth/jwt");

  for (const cookieName of AUTHJS_SESSION_COOKIE_NAMES) {
    const token = await getToken({
      req: request,
      secret,
      cookieName,
      salt: cookieName,
    });

    if (token) return token;
  }

  return null;
}

function hasAuthJsSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name, value }) => {
    if (!value) return false;
    return AUTHJS_SESSION_COOKIE_NAMES.some(
      (cookieName) => name === cookieName || name.startsWith(`${cookieName}.`)
    );
  });
}

async function getActiveUserPayload(token: JWT): Promise<JWTPayload | null> {
  if (typeof token.id !== "string" || typeof token.sessionId !== "string") {
    return null;
  }

  await dbConnect();
  if (!(await validateAuthSession(token.sessionId, token.id, true))) return null;

  const user = await User.findById(token.id);
  if (!user || !isUserRole(user.role) || !isSubscriptionTier(user.subscriptionTier)) {
    return null;
  }

  return {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    subscriptionTier: user.subscriptionTier,
    sessionId: token.sessionId,
  };
}

function isUserRole(value: unknown): value is UserRole {
  return value === "student" || value === "teacher" || value === "admin";
}

function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return value === "free" || value === "plus" || value === "admin";
}

export async function getAuthenticatedUser(
  request: NextRequest
): Promise<IUser | null> {
  const payload = await authenticate(request);
  if (!payload) return null;

  await dbConnect();
  const user = await User.findById(payload.userId);
  return user;
}

export function requireAuth(
  handler: (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: JWTPayload
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(request, context, user);
  };
}

export function requireRole(...roles: ("student" | "teacher" | "admin")[]) {
  return (
    handler: (
      request: NextRequest,
      context: { params: Promise<Record<string, string>> },
      user: JWTPayload
    ) => Promise<NextResponse>
  ) => {
    return async (
      request: NextRequest,
      context: { params: Promise<Record<string, string>> }
    ): Promise<NextResponse> => {
      const csrfError = requireCsrf(request);
      if (csrfError) return csrfError;

      const user = await authenticate(request);

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (!roles.includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return handler(request, context, user);
    };
  };
}
