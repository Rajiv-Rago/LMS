import {
  AUTHJS_SESSION_COOKIE,
  decodeAuthJsSessionToken,
} from "./authjsToken";

interface GetTokenParams {
  req: Request;
  cookieName?: string;
}

export async function getToken({
  req,
  cookieName = AUTHJS_SESSION_COOKIE,
}: GetTokenParams): Promise<Record<string, unknown> | null> {
  const cookieHeader = req.headers.get("cookie");
  const rawToken = cookieHeader
    ? getCookieValue(cookieHeader, cookieName)
    : getBearerToken(req);

  if (!rawToken) return null;
  return decodeAuthJsSessionToken(rawToken);
}

function getCookieValue(cookieHeader: string, cookieName: string): string | null {
  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name === cookieName) return valueParts.join("=");
  }

  return null;
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return decodeURIComponent(authHeader.slice("Bearer ".length));
}
