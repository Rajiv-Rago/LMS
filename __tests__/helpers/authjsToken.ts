import crypto from "crypto";

export const AUTHJS_SESSION_COOKIE = "authjs.session-token";

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function encodeAuthJsSessionToken(
  token: Record<string, unknown>
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode({
    ...token,
    iat: now,
    exp: now + MAX_AGE_SECONDS,
  });
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

export function decodeAuthJsSessionToken(token: string): Record<string, unknown> | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof decoded.exp === "number" && decoded.exp < Date.now() / 1000) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function base64UrlEncode(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", process.env.AUTH_SECRET || process.env.JWT_SECRET!)
    .update(payload)
    .digest("base64url");
}
