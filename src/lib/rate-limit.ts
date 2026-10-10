import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Bucket = { count: number; expiresAt: number };
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number; available: boolean };

export function getClientRateLimitKey(headers: Headers): string | null {
  if (process.env.VERCEL !== "1") return "client:local";
  const address = headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const key = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!address || !key) return null;
  const digest = createHmac("sha256", key).update(address).digest("hex");
  return `client:${digest}`;
}

const buckets = new Map<string, Bucket>();
const limiters = new Map<string, Ratelimit>();

function takeLocalRateLimit(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
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
    available: true,
  };
}

function getLimiter(limit: number, windowMs: number) {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const key = `${limit}:${windowSeconds}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.fixedWindow(limit, `${windowSeconds} s`),
      prefix: "manpost:rate-limit",
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url && !token) {
    if (process.env.NODE_ENV === "production") {
      return { allowed: false, retryAfterSeconds: 60, available: false };
    }
    return takeLocalRateLimit(key, limit, windowMs, now);
  }
  if (!url || !token) return { allowed: false, retryAfterSeconds: 60, available: false };

  try {
    const result = await getLimiter(limit, windowMs).limit(key);
    return {
      allowed: result.success,
      retryAfterSeconds: Math.max(1, Math.ceil((result.reset - now) / 1000)),
      available: true,
    };
  } catch (error) {
    console.error("Shared rate limiter is unavailable", error instanceof Error ? error.name : "Unknown error");
    return { allowed: false, retryAfterSeconds: 60, available: false };
  }
}

export async function checkClientRateLimit(headers: Headers, limit: number, windowMs: number) {
  const key = getClientRateLimitKey(headers);
  if (!key) return { allowed: false, retryAfterSeconds: 60, available: false };
  return checkRateLimit(key, limit, windowMs);
}

export function resetRateLimitsForTests() {
  buckets.clear();
  limiters.clear();
}
