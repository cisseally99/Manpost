type Bucket = { count: number; expiresAt: number };
const buckets = new Map<string, Bucket>();

export function takeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
  let bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    bucket = { count: 0, expiresAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  if (buckets.size > 10_000) {
    for (const [entryKey, entry] of buckets) if (entry.expiresAt <= now) buckets.delete(entryKey);
  }

  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
  };
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
