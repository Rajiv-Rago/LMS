import jwt, { SignOptions } from "jsonwebtoken";
import { IUser } from "@/lib/models/User";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const JWT_SECRET: string = process.env.JWT_SECRET;

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];
const REFRESH_GRACE_PERIOD = 60 * 60; // 1 hour in seconds

export interface JWTPayload {
  userId: string;
  email: string;
  role: "student" | "teacher" | "admin";
  iat?: number;
  exp?: number;
}

export function signToken(user: IUser): string {
  const payload: JWTPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
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
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      const decoded = jwt.decode(token) as JWTPayload | null;
      if (!decoded?.exp) return null;
      const now = Math.floor(Date.now() / 1000);
      if (now - decoded.exp <= REFRESH_GRACE_PERIOD) {
        return decoded;
      }
    }
    return null;
  }
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}
