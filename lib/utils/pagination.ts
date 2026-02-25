import { NextRequest } from "next/server";

interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

interface PaginationDefaults {
  page?: number;
  limit?: number;
  maxLimit?: number;
}

/**
 * Parse pagination query params from a request.
 * Clamps page >= 1 and 1 <= limit <= maxLimit.
 */
export function parsePagination(
  request: NextRequest,
  defaults?: PaginationDefaults
): PaginationParams {
  const { searchParams } = new URL(request.url);
  const defaultLimit = defaults?.limit ?? 20;
  const maxLimit = defaults?.maxLimit ?? 100;

  const page = Math.max(1, parseInt(searchParams.get("page") || String(defaults?.page ?? 1)));
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit))));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Build a pagination metadata object for responses.
 * Guards against divide-by-zero on limit.
 */
export function paginationMeta(
  total: number,
  page: number,
  limit: number
): { page: number; limit: number; total: number; pages: number } {
  const safeLimit = Math.max(1, limit);
  return {
    page,
    limit: safeLimit,
    total,
    pages: Math.ceil(total / safeLimit),
  };
}
