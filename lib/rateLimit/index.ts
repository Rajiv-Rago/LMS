import { logger } from "@/lib/logger";
import { MemoryRateLimitStore } from "./stores/memory";
import type { RateLimitStore, RateLimitConfig, RateLimitCheckResult } from "./types";

export type { RateLimitStore, RateLimitConfig, RateLimitCheckResult } from "./types";
export type { RateLimitStoreName } from "./types";

/**
 * Endpoint-specific rate limit configuration.
 */
export const RATE_LIMIT_RULES: Record<string, RateLimitConfig> = {
  "/api/auth/login":           { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
  "/api/auth/register":        { maxAttempts: 5,  windowMs: 60 * 60 * 1000 },
  "/api/auth/forgot-password": { maxAttempts: 5,  windowMs: 15 * 60 * 1000 },
};

/** Cached singleton store instance. */
let _store: RateLimitStore | null = null;

/**
 * Set a custom rate limit store. Call this at app startup to use Redis.
 *
 * Example (in a server-side init file or API route):
 *
 *   import { setRateLimitStore } from "@/lib/rateLimit";
 *   import { RedisRateLimitStore } from "@/lib/rateLimit/stores/redis";
 *   setRateLimitStore(new RedisRateLimitStore());
 *
 * If not called, defaults to MemoryRateLimitStore (in-process, per-instance).
 * See docs/INFRASTRUCTURE_SETUP.md for full setup instructions.
 */
export function setRateLimitStore(store: RateLimitStore): void {
  _store = store;
  logger.info(`Rate limit store set: ${store.name}`);
}

export function getRateLimitStore(): RateLimitStore {
  if (!_store) {
    _store = new MemoryRateLimitStore();
    logger.info(`Rate limit store initialized: ${_store.name} (default)`);
  }
  return _store;
}

/**
 * Check rate limit for a given IP + path combination.
 * Drop-in replacement for the old in-memory checkRateLimit function.
 */
export async function checkRateLimit(
  ip: string,
  path: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const config = RATE_LIMIT_RULES[path];
  if (!config) return { allowed: true };

  const store = getRateLimitStore();

  // Periodic cleanup (only relevant for memory store)
  if (store.cleanup) {
    store.cleanup().catch(() => {});
  }

  const key = `${ip}:${path}`;
  const result = await store.increment(key, config);

  return {
    allowed: result.allowed,
    retryAfter: result.retryAfter,
  };
}

/**
 * Reset the cached store — useful in tests or when env changes.
 */
export function resetRateLimitStore(): void {
  _store = null;
}
