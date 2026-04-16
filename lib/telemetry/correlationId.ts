import { NextRequest } from "next/server";

export const CORRELATION_HEADER = "x-correlation-id";

export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

export function getCorrelationId(request: NextRequest): string {
  return request.headers.get(CORRELATION_HEADER) || generateCorrelationId();
}
