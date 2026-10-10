import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import {
  BodyTooLargeError,
  InputError,
  isPublicAddress,
  isSameOriginMutation,
  readJsonBody,
  resolvePublicTarget,
  sendBoundedRequest,
  validateOutboundInput,
} from "../src/lib/request-security.ts";

test("outbound validation accepts an ordinary public HTTPS request", () => {
  const input = validateOutboundInput({ method: "get", url: "https://example.com/api", query: { page: 1 } });
  assert.equal(input.method, "GET");
  assert.equal(input.url.hostname, "example.com");
  assert.deepEqual(input.query, { page: "1" });
});

test("outbound validation rejects unsafe URL schemes and embedded credentials", () => {
  assert.throws(() => validateOutboundInput({ method: "GET", url: "file:///etc/passwd" }), InputError);
  assert.throws(() => validateOutboundInput({ method: "GET", url: "https://user:pass@example.com" }), InputError);
});

test("outbound validation rejects forbidden headers and oversized bodies", () => {
  assert.throws(() => validateOutboundInput({ method: "GET", url: "https://example.com", headers: { Host: "internal" } }), InputError);
  assert.throws(() => validateOutboundInput({ method: "POST", url: "https://example.com", body: "x".repeat(100_001) }), InputError);
});

test("public address check allows global addresses but blocks special ranges", () => {
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(isPublicAddress(address), true, address);
  for (const address of ["127.0.0.1", "10.0.0.5", "172.16.2.3", "192.168.1.2", "169.254.1.1", "100.64.0.1", "224.0.0.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "2001:db8::1", "2001:0db8::1", "2002::1"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("DNS validation rejects mixed public and private answers", async () => {
  const url = new URL("https://example.com");
  await assert.rejects(resolvePublicTarget(url, async () => [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }]), InputError);
  await assert.rejects(resolvePublicTarget(url, async () => []), InputError);
  const addresses = await resolvePublicTarget(url, async () => [{ address: "8.8.8.8", family: 4 }]);
  assert.equal(addresses[0]?.address, "8.8.8.8");
});

test("JSON body reader enforces a byte limit and rejects malformed JSON", async () => {
  const validRequest = new Request("http://localhost/api", { method: "POST", body: "{\"ok\":true}" });
  assert.deepEqual(await readJsonBody(validRequest), { ok: true });
  const oversized = new Request("http://localhost/api", { method: "POST", body: "12345" });
  await assert.rejects(readJsonBody(oversized, 4), BodyTooLargeError);
  const malformed = new Request("http://localhost/api", { method: "POST", body: "{" });
  await assert.rejects(readJsonBody(malformed), /valid JSON/);
});

test("mutations require a matching same-origin Origin header", () => {
  assert.equal(isSameOriginMutation(new Request("http://localhost:3000/api", { method: "POST", headers: { Origin: "http://localhost:3000" } })), true);
  assert.equal(isSameOriginMutation(new Request("http://localhost:3000/api", { method: "POST", headers: { Origin: "https://attacker.example" } })), false);
  assert.equal(isSameOriginMutation(new Request("http://localhost:3000/api", { method: "POST" })), false);
  assert.equal(isSameOriginMutation(new Request("http://localhost:3000/api", { method: "POST", headers: { Origin: "http://localhost:3000", "Sec-Fetch-Site": "cross-site" } })), false);
});

test("outbound transport caps response bodies and does not follow redirects", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "/large" }).end("redirect");
    } else {
      response.writeHead(200, { "Content-Type": "text/plain" }).end("response body larger than the test cap");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const port = address.port;
    const base = { method: "GET" as const, query: {}, headers: {}, body: undefined };
    const target = [{ address: "127.0.0.1", family: 4 as const }];
    const capped = await sendBoundedRequest({ ...base, url: new URL(`http://127.0.0.1:${port}/large`) }, target, 8);
    assert.equal(capped.body, "response");
    assert.equal(capped.bodyTruncated, true);
    const redirect = await sendBoundedRequest({ ...base, url: new URL(`http://127.0.0.1:${port}/redirect`) }, target);
    assert.equal(redirect.status, 302);
    assert.equal(redirect.body, "redirect");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
