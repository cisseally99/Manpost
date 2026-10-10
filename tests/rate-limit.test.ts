import assert from "node:assert/strict";
import test from "node:test";
import { checkRateLimit, resetRateLimitsForTests } from "../src/lib/rate-limit.ts";

const environment = process.env as Record<string, string | undefined>;

test("local rate limit allows the configured number then blocks until the window expires", async () => {
  delete environment.UPSTASH_REDIS_REST_URL;
  delete environment.UPSTASH_REDIS_REST_TOKEN;
  environment.NODE_ENV = "test";
  resetRateLimitsForTests();
  assert.equal((await checkRateLimit("user-1", 2, 1_000, 10_000)).allowed, true);
  assert.equal((await checkRateLimit("user-1", 2, 1_000, 10_100)).allowed, true);
  const blocked = await checkRateLimit("user-1", 2, 1_000, 10_200);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  assert.equal((await checkRateLimit("user-1", 2, 1_000, 11_000)).allowed, true);
  resetRateLimitsForTests();
});

test("production refuses requests when the shared limiter is not configured", async () => {
  const previousNodeEnv = environment.NODE_ENV;
  environment.NODE_ENV = "production";
  delete environment.UPSTASH_REDIS_REST_URL;
  delete environment.UPSTASH_REDIS_REST_TOKEN;
  const result = await checkRateLimit("user-2", 1, 1_000);
  assert.equal(result.available, false);
  assert.equal(result.allowed, false);
  if (previousNodeEnv === undefined) delete environment.NODE_ENV;
  else environment.NODE_ENV = previousNodeEnv;
});

test("partial shared limiter configuration fails closed", async () => {
  environment.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  delete environment.UPSTASH_REDIS_REST_TOKEN;
  const result = await checkRateLimit("user-3", 1, 1_000);
  assert.equal(result.available, false);
  assert.equal(result.allowed, false);
  delete environment.UPSTASH_REDIS_REST_URL;
});
