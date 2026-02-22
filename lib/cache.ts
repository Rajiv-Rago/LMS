interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MAX_ENTRIES = 1000;
const store = new Map<string, CacheEntry<unknown>>();

export function get<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  // Move to end for LRU ordering (Map preserves insertion order)
  store.delete(key);
  store.set(key, entry);

  return entry.value as T;
}

export function set<T>(key: string, value: T, ttlSeconds: number): void {
  // Evict oldest if at capacity
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) {
      store.delete(oldest);
    }
  }

  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function invalidate(key: string): void {
  store.delete(key);
}

export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}
