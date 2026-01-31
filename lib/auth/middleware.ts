import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JWTPayload } from "./jwt";
import { dbConnect } from "@/lib/db";
import User, { IUser } from "@/lib/models/User";

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const cookieToken = request.cookies.get("token")?.value;
  return cookieToken || null;
}

export async function authenticate(
  request: NextRequest
): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  const payload = verifyToken(token);
  return payload;
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

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
