import crypto from "crypto";
import { cookies } from "next/headers";
import { OAuthProvider } from "@/lib/models/OAuthAccount";

export const OAUTH_LINK_INTENT_COOKIE = "oauth_link_intent";

const LINK_INTENT_MAX_AGE_SECONDS = 5 * 60;

interface OAuthLinkIntent {
  userId: string;
  provider: OAuthProvider;
  exp: number;
}

export function createOAuthLinkIntent(
  userId: string,
  provider: OAuthProvider
): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      provider,
      exp: Math.floor(Date.now() / 1000) + LINK_INTENT_MAX_AGE_SECONDS,
    })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthLinkIntent(
  token: string | undefined,
  provider: OAuthProvider
): OAuthLinkIntent | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !isEqual(signature, sign(payload))) return null;

  try {
    const intent = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as OAuthLinkIntent;

    if (
      intent.provider !== provider ||
      typeof intent.userId !== "string" ||
      intent.exp < Date.now() / 1000
    ) {
      return null;
    }

    return intent;
  } catch {
    return null;
  }
}

export async function getOAuthLinkIntent(
  provider: OAuthProvider
): Promise<OAuthLinkIntent | null> {
  const cookieStore = await cookies();
  return verifyOAuthLinkIntent(
    cookieStore.get(OAUTH_LINK_INTENT_COOKIE)?.value,
    provider
  );
}

export async function clearOAuthLinkIntent(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(OAUTH_LINK_INTENT_COOKIE);
  } catch {
    // Cookie deletion is best-effort from Auth.js callback context.
  }
}

export function oauthLinkIntentCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: LINK_INTENT_MAX_AGE_SECONDS,
    path: "/",
  };
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", process.env.AUTH_SECRET || process.env.JWT_SECRET!)
    .update(payload)
    .digest("base64url");
}

function isEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}
