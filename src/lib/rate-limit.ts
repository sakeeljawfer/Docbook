import { headers } from 'next/headers';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, RateLimitBucket>();

const CLEANUP_INTERVAL = 60000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > CLEANUP_INTERVAL) {
      buckets.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

export async function rateLimit(maxRequests: number, windowMs: number): Promise<boolean> {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '127.0.0.1';
  const key = ip;

  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxRequests, lastRefill: now };
    buckets.set(key, bucket);
    return true;
  }

  const timePassed = now - bucket.lastRefill;
  const tokensToAdd = (timePassed / windowMs) * maxRequests;

  bucket.tokens = Math.min(maxRequests, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

export async function createRateLimitError() {
  return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
  });
}
