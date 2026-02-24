/**
 * Rate Limit Store — Abstraction Layer
 *
 * Pluggable store for rate limiting state. Ships with an in-memory store.
 * Swap in Redis for production multi-instance deployments.
 *
 * See docs/INFRASTRUCTURE_SETUP.md for integration instructions.
 */

export interface RateLimitEntry {
  count: number;
  /** Unix timestamp (ms) when the window started. */
  windowStart: number;
}

export interface RateLimitConfig {
  /** Max requests allowed within the window. */
  maxAttempts: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  /** Seconds until the window resets (present when blocked). */
  retryAfter?: number;
  /** Current count within the window. */
  current: number;
  /** Configured limit. */
  limit: number;
}

/**
 * All rate limit stores must implement this interface.
 */
export interface RateLimitStore {
  readonly name: string;
  /**
   * Increment the counter for a key and return whether the request is allowed.
   * The store is responsible for window expiration.
   */
  increment(key: string, config: RateLimitConfig): Promise<RateLimitCheckResult>;
  /**
   * Reset a specific key (e.g., after successful login clears failed attempt tracking).
   */
  reset(key: string): Promise<void>;
  /**
   * Clean up expired entries. Called periodically by the middleware.
   * Optional — Redis handles TTL natively.
   */
  cleanup?(): Promise<void>;
}

export type RateLimitStoreName = "memory" | "redis";
