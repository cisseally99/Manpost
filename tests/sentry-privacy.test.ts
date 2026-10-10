import assert from "node:assert/strict";
import test from "node:test";
import { scrubSentryEvent } from "../src/lib/sentry-privacy.ts";

test("Sentry events omit request, identity, breadcrumbs, and extra context", () => {
  const cleaned = scrubSentryEvent({
    type: undefined,
    request: { url: "https://example.test", headers: { authorization: "secret" } },
    user: { email: "person@example.test" },
    breadcrumbs: [{ message: "request with sensitive data" }],
    extra: { body: "private request body" },
    message: "Request failed",
  });

  assert.equal(cleaned.request, undefined);
  assert.equal(cleaned.user, undefined);
  assert.equal(cleaned.breadcrumbs, undefined);
  assert.equal(cleaned.extra, undefined);
  assert.equal(cleaned.message, "Request failed");
});

test("Sentry exception text redacts common credential labels", () => {
  const cleaned = scrubSentryEvent({
    type: undefined,
    exception: {
      values: [
        {
          type: "Error",
          value: "authorization: Bearer-secret password=hunter2 api_key=abc123",
        },
      ],
    },
  });

  assert.equal(
    cleaned.exception?.values?.[0]?.value,
    "authorization: [Filtered] password=[Filtered] api_key=[Filtered]",
  );
});
