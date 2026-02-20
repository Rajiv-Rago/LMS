import { NextRequest } from "next/server";

interface ApiRequestOptions {
  body?: Record<string, unknown>;
  token?: string;
  searchParams?: Record<string, string>;
}

/**
 * Build a NextRequest object for testing route handlers directly.
 */
export function buildRequest(
  method: string,
  path: string,
  options: ApiRequestOptions = {}
): NextRequest {
  const url = new URL(path, "http://localhost:3000");

  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const headers = new Headers({
    "Content-Type": "application/json",
  });

  // Add CSRF header for mutation methods
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
    headers.set("X-Requested-With", "XMLHttpRequest");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const init: RequestInit & { method: string } = {
    method,
    headers,
  };

  if (options.body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    init.body = JSON.stringify(options.body);
  }

  return new NextRequest(url, init);
}

/**
 * Parse a NextResponse into a typed result.
 */
export async function parseResponse<T = Record<string, unknown>>(
  response: Response
): Promise<{ status: number; data: T }> {
  const data = (await response.json()) as T;
  return { status: response.status, data };
}
