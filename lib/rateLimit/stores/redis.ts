import type {
  RateLimitStore,
  RateLimitConfig,
  RateLimitCheckResult,
} from "../types";

/**
 * Redis-backed rate limit store — scaffold.
 *
 * To activate:
 * 1. npm install ioredis
 * 2. Set RATE_LIMIT_STORE=redis in .env
 * 3. Set REDIS_URL in .env (e.g. redis://localhost:6379)
 *
 * Uses a counter per key with TTL for expiration.
 * TTL is set on each key so Redis handles expiration natively (no cleanup needed).
 *
 * See docs/INFRASTRUCTURE_SETUP.md for full instructions.
 */

/** Minimal typed interface for the ioredis client used here. */
interface RedisClient {
  connect(): Promise<void>;
  incr(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;
  pipeline(): {
    incr(key: string): unknown;
    ttl(key: string): unknown;
    exec(): Promise<Array<[Error | null, unknown]> | null>;
  };
}

export class RedisRateLimitStore implements RateLimitStore {
  readonly name = "redis" as const;

  private client: RedisClient | null = null;
  private redisUrl: string;
  private keyPrefix: string;

  constructor(keyPrefix = "rl:") {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error(
        "REDIS_URL is required when RATE_LIMIT_STORE=redis. " +
          "See docs/INFRASTRUCTURE_SETUP.md for setup instructions."
      );
    }
    this.redisUrl = url;
    this.keyPrefix = keyPrefix;
  }

  private async getClient(): Promise<RedisClient> {
    if (this.client) return this.client;

    // Dynamic require so the dependency is only needed when this store is used.
    // Install: npm install ioredis
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require("ioredis") as new (
      url: string,
      opts: Record<string, unknown>
    ) => RedisClient;

    this.client = new Redis(this.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
    });
    await this.client.connect();
    return this.client;
  }

  async increment(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitCheckResult> {
    const redis = await this.getClient();
    const fullKey = `${this.keyPrefix}${key}`;
    const windowSeconds = Math.ceil(config.windowMs / 1000);

    // Atomic increment + TTL via pipeline
    const pipeline = redis.pipeline();
    pipeline.incr(fullKey);
    pipeline.ttl(fullKey);
    const results = await pipeline.exec();

    const count = (results?.[0]?.[1] as number) ?? 1;
    const ttl = (results?.[1]?.[1] as number) ?? -1;

    // Set TTL on first request (when key was just created)
    if (ttl === -1 || count === 1) {
      await redis.expire(fullKey, windowSeconds);
    }

    if (count > config.maxAttempts) {
      const currentTtl = ttl > 0 ? ttl : windowSeconds;
      return {
        allowed: false,
        retryAfter: currentTtl,
        current: count,
        limit: config.maxAttempts,
      };
    }

    return { allowed: true, current: count, limit: config.maxAttempts };
  }

  async reset(key: string): Promise<void> {
    const redis = await this.getClient();
    await redis.del(`${this.keyPrefix}${key}`);
  }

  // Redis handles TTL natively — no manual cleanup needed.
}
