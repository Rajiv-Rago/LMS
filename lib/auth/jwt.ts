import jwt, { SignOptions } from "jsonwebtoken";
import { IUser } from "@/lib/models/User";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const JWT_SECRET: string = process.env.JWT_SECRET;

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];
const REFRESH_GRACE_PERIOD_SECONDS = 60 * 60; // 1 hour in seconds

export type SubscriptionTier = "free" | "plus" | "admin";

export interface JWTPayload {
  userId: string;
  email: string;
  role: "student" | "teacher" | "admin";
  subscriptionTier: SubscriptionTier;
  iat?: number;
  exp?: number;
}

export function signToken(user: IUser): string {
  const payload: JWTPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    subscriptionTier: user.role === "admin" ? "admin" : (user.subscriptionTier || "free"),
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyTokenForRefresh(token: string): JWTPayload | null {
  try {
    // First try normal verification
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      // Verify signature while ignoring expiration
      try {
        const payload = jwt.verify(token, JWT_SECRET, {
          ignoreExpiration: true,
        }) as JWTPayload;
        if (!payload.exp) return null;
        const now = Math.floor(Date.now() / 1000);
        if (now - payload.exp <= REFRESH_GRACE_PERIOD_SECONDS) {
          return payload;
        }
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * WARNING: This function does NOT verify the token signature.
 * It only base64-decodes the payload. NEVER use this for authorization
 * decisions — use `verifyToken()` instead. This is only for reading
 * claims from tokens whose authenticity has already been established.
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}
