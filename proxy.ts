import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/utils/request";
import { CORRELATION_HEADER, getCorrelationId } from "@/lib/telemetry/correlationId";

// --- Rate Limiting (in-memory, per-instance) ---

interface RateLimitEntry {
  count: number;
  timestamp: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// NOTE: Rate limiting trusts X-Forwarded-For from the reverse proxy.
// In production, ensure your proxy (nginx, Cloudflare, Vercel) overwrites
// this header. The in-memory store is per-instance — for horizontal scaling,
// use an edge rate limiter or move to a shared store (Redis/MongoDB).
const RATE_LIMIT_CONFIG: Record<string, { maxAttempts: number; windowMs: number }> = {
  "/api/auth/login": { maxAttempts: 10, windowMs: 15 * 60 * 1000 },      // 10 per 15 min
  "/api/auth/register": { maxAttempts: 5, windowMs: 60 * 60 * 1000 },    // 5 per hour
  "/api/auth/forgot-password": { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
  "/api/auth/reset-password": { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
};

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const maxWindow = Math.max(...Object.values(RATE_LIMIT_CONFIG).map((c) => c.windowMs));
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.timestamp > maxWindow) {
      rateLimitMap.delete(key);
    }
  }
}

function checkRateLimit(
  ip: string,
  path: string
): { allowed: boolean; retryAfter?: number } {
  const config = RATE_LIMIT_CONFIG[path];
  if (!config) return { allowed: true };

  cleanupRateLimitMap();

  const key = `${ip}:${path}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.timestamp > config.windowMs) {
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return { allowed: true };
  }

  if (entry.count >= config.maxAttempts) {
    const retryAfter = Math.ceil((entry.timestamp + config.windowMs - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

// --- Security Headers ---

function addSecurityHeaders(response: NextResponse): void {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  // CSP only in production — avoids breaking Next.js HMR/dev tooling
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.ytimg.com; font-src 'self'; connect-src 'self'; frame-src https://www.youtube.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
  }
}

// --- Proxy (renamed from middleware in Next.js 16) ---

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. Correlation ID — read from incoming header or generate
  const correlationId = getCorrelationId(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_HEADER, correlationId);

  // 1. Rate Limiting (auth endpoints only)
  if (request.method === "POST" && RATE_LIMIT_CONFIG[pathname]) {
    const ip = getClientIp(request);
    const { allowed, retryAfter } = checkRateLimit(ip, pathname);

    if (!allowed) {
      const response = NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
      response.headers.set("Retry-After", String(retryAfter));
      response.headers.set(CORRELATION_HEADER, correlationId);
      addSecurityHeaders(response);
      return response;
    }
  }

  // 2. Auth redirect for dashboard routes (edge-level)
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/courses") || pathname.startsWith("/profile")) {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      addSecurityHeaders(response);
      return response;
    }
  }

  // 3. Add security headers + correlation ID to all responses
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(CORRELATION_HEADER, correlationId);
  addSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
