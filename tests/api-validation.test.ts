import assert from "node:assert/strict";
import test from "node:test";
import { validatePersistedRequest } from "../src/lib/api-validation.ts";
import { InputError } from "../src/lib/request-security.ts";

const validRows = { params: [], headers: [], body: "" };

test("persisted request accepts a URL with an environment base URL template", () => {
  const request = validatePersistedRequest({ ...validRows, method: "GET", url: "{{baseUrl}}/get" });
  assert.equal(request.url, "{{baseUrl}}/get");
});

test("persisted request accepts environment variables in a URL host or path", () => {
  assert.equal(validatePersistedRequest({ ...validRows, method: "GET", url: "https://{{apiHost}}/{{version}}/items" }).url, "https://{{apiHost}}/{{version}}/items");
});

test("persisted request still rejects unsupported URL schemes and malformed templates", () => {
  assert.throws(() => validatePersistedRequest({ ...validRows, method: "GET", url: "file:///tmp/data" }), InputError);
  assert.throws(() => validatePersistedRequest({ ...validRows, method: "GET", url: "https://example.com/{{missing" }), InputError);
});
