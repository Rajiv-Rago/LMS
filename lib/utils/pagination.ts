/**
 * Shared pagination utilities for API route handlers.
 *
 * Usage:
 *   const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, { limit: 20, maxLimit: 100 });
 *   const [items, total] = await Promise.all([Model.find(q).skip(skip).limit(limit), Model.countDocuments(q)]);
 *   return NextResponse.json({ data: items, pagination: paginationMeta(page, limit, total) });
 */

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { limit?: number; maxLimit?: number } = {}
): PaginationParams {
  const { limit: defaultLimit = 20, maxLimit = 100 } = defaults;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit), 10))
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  return { page, limit, total, pages: Math.ceil(total / limit) };
}
