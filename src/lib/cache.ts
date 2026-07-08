interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const CACHE_TTL = {
  doctors: 60000,
  appointments: 30000,
  queue_status: 15000,
  queue_summary: 30000
};

export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttlKey: keyof typeof CACHE_TTL): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL[ttlKey]
  });
}

export function cacheInvalidate(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > (entry as CacheEntry<unknown>).expiresAt) {
      cache.delete(key);
    }
  }
}, 60000);
