import type {
  RateLimitStore,
  RateLimitConfig,
  RateLimitCheckResult,
  RateLimitEntry,
} from "../types";

/**
 * In-memory rate limit store.
 *
 * Works well for single-instance deployments and development.
 * State is lost on server restart and not shared across instances.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  readonly name = "memory" as const;

  private entries = new Map<string, RateLimitEntry>();
  private lastCleanup = Date.now();
  private cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes

  async increment(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitCheckResult> {
    const now = Date.now();
    const entry = this.entries.get(key);

    // Window expired or no entry — start fresh
    if (!entry || now - entry.windowStart > config.windowMs) {
      this.entries.set(key, { count: 1, windowStart: now });
      return { allowed: true, current: 1, limit: config.maxAttempts };
    }

    // Within window — check limit
    if (entry.count >= config.maxAttempts) {
      const retryAfter = Math.ceil(
        (entry.windowStart + config.windowMs - now) / 1000
      );
      return {
        allowed: false,
        retryAfter,
        current: entry.count,
        limit: config.maxAttempts,
      };
    }

    // Allowed — increment
    entry.count++;
    return { allowed: true, current: entry.count, limit: config.maxAttempts };
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupIntervalMs) return;
    this.lastCleanup = now;

    // Use a generous max window for cleanup
    const maxWindowMs = 60 * 60 * 1000; // 1 hour
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart > maxWindowMs) {
        this.entries.delete(key);
      }
    }
  }
}
