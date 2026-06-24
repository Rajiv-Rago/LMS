import crypto from "crypto";
import { NextRequest } from "next/server";
import { dbConnect } from "@/lib/db";
import AuthSession from "@/lib/models/AuthSession";
import { getClientIp } from "@/lib/utils/request";

export const AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export async function createAuthSession(
  userId: string,
  request: NextRequest
): Promise<string>;
export async function createAuthSession(
  userId: string,
  metadata: { ip: string; userAgent: string }
): Promise<string>;
export async function createAuthSession(
  userId: string,
  source: NextRequest | { ip: string; userAgent: string }
): Promise<string> {
  await dbConnect();

  const sessionId = crypto.randomUUID();
  const now = new Date();
  const metadata =
    source instanceof NextRequest
      ? {
          ip: getClientIp(source),
          userAgent: source.headers.get("user-agent") || "unknown",
        }
      : source;

  await AuthSession.create({
    sessionId,
    userId,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    lastActiveAt: now,
    expiresAt: new Date(now.getTime() + AUTH_SESSION_MAX_AGE_SECONDS * 1000),
  });

  return sessionId;
}

export async function validateAuthSession(
  sessionId: string,
  userId: string,
  updateActivity = false
): Promise<boolean> {
  await dbConnect();

  const now = new Date();
  const session = await AuthSession.findOne({
    sessionId,
    userId,
    expiresAt: { $gt: now },
  });

  if (!session) return false;

  if (
    updateActivity &&
    now.getTime() - session.lastActiveAt.getTime() >= ACTIVITY_UPDATE_INTERVAL_MS
  ) {
    session.lastActiveAt = now;
    session.expiresAt = new Date(
      now.getTime() + AUTH_SESSION_MAX_AGE_SECONDS * 1000
    );
    await session.save();
  }

  return true;
}

export async function revokeAuthSession(sessionId: string): Promise<void> {
  await dbConnect();
  await AuthSession.deleteOne({ sessionId });
}
