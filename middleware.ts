import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/utils/request";
import { checkRateLimit, RATE_LIMIT_RULES } from "@/lib/rateLimit";

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
}

// --- Middleware ---

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate Limiting (auth endpoints only)
  if (request.method === "POST" && RATE_LIMIT_RULES[pathname]) {
    const ip = getClientIp(request);
    const { allowed, retryAfter } = await checkRateLimit(ip, pathname);

    if (!allowed) {
      const response = NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
      response.headers.set("Retry-After", String(retryAfter));
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

  // 3. Add security headers to all responses
  const response = NextResponse.next();
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
