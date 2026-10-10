import assert from "node:assert/strict";
import test from "node:test";
import { resetRateLimitsForTests, takeRateLimit } from "../src/lib/rate-limit.ts";

test("rate limit allows the configured number then blocks until the window expires", () => {
  resetRateLimitsForTests();
  assert.equal(takeRateLimit("user-1", 2, 1_000, 10_000).allowed, true);
  assert.equal(takeRateLimit("user-1", 2, 1_000, 10_100).allowed, true);
  const blocked = takeRateLimit("user-1", 2, 1_000, 10_200);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  assert.equal(takeRateLimit("user-1", 2, 1_000, 11_000).allowed, true);
  resetRateLimitsForTests();
});
