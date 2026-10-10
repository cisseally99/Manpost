import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];
export type KeyValueRow = { id: number; key: string; value: string; enabled: boolean };

export class InputError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "InputError";
    this.status = status;
  }
}

export class BodyTooLargeError extends InputError {
  constructor() {
    super("The request is too large. Keep the request under 256 KB.", 413);
    this.name = "BodyTooLargeError";
  }
}

export type OutboundInput = {
  method: HttpMethod;
  url: URL;
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: string;
};

const disallowedRequestHeaders = new Set([
  "connection", "content-length", "expect", "host", "keep-alive", "proxy-authorization",
  "proxy-connection", "te", "trailer", "transfer-encoding", "upgrade",
]);

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export async function readJsonBody(request: Request, maxBytes = 256_000): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) throw new BodyTooLargeError();
  if (!request.body) throw new InputError("A JSON request body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError("The request body must be valid JSON.");
  }
}

function parseStringMap(value: unknown, label: string, maxEntries: number, maxValueLength: number): Record<string, string> {
  if (value === undefined) return {};
  if (!isPlainObject(value)) throw new InputError(`${label} must be an object.`);
  const entries = Object.entries(value);
  if (entries.length > maxEntries) throw new InputError(`Too many ${label.toLowerCase()}.`);

  const output: Record<string, string> = {};
  for (const [key, rawValue] of entries) {
    if (!key.trim() || key.length > 256) throw new InputError(`A ${label.toLowerCase()} key is invalid.`);
    if (typeof rawValue !== "string" && typeof rawValue !== "number" && typeof rawValue !== "boolean") {
      throw new InputError(`${label} values must be text or simple numbers.`);
    }
    const stringValue = String(rawValue);
    if (stringValue.length > maxValueLength) throw new InputError(`A ${label.toLowerCase()} value is too long.`);
    output[key] = stringValue;
  }
  return output;
}

export function validateOutboundInput(payload: unknown): OutboundInput {
  if (!isPlainObject(payload)) throw new InputError("Request details must be a JSON object.");
  const rawMethod = typeof payload.method === "string" ? payload.method.toUpperCase() : "";
  if (!HTTP_METHODS.includes(rawMethod as HttpMethod)) throw new InputError("Choose a supported HTTP method.");
  if (typeof payload.url !== "string" || payload.url.length > 2048) throw new InputError("Enter a valid URL under 2,048 characters.");

  let url: URL;
  try {
    url = new URL(payload.url);
  } catch {
    throw new InputError("Enter a complete URL, such as https://example.com/api.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new InputError("Only HTTP and HTTPS URLs are supported.");
  if (url.username || url.password) throw new InputError("URLs must not include a username or password.");
  if (!url.hostname || url.hostname.includes("%")) throw new InputError("The destination host is invalid.");
  url.hash = "";

  const query = parseStringMap(payload.query, "Query parameters", 100, 2048);
  const headers = parseStringMap(payload.headers, "Request headers", 50, 8192);
  let headerBytes = 0;
  for (const [name, value] of Object.entries(headers)) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || disallowedRequestHeaders.has(name.toLowerCase())) {
      throw new InputError(`The request header “${name}” is not allowed.`);
    }
    if (/[\r\n\0-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) throw new InputError(`The value for “${name}” contains invalid characters.`);
    headerBytes += Buffer.byteLength(name) + Buffer.byteLength(value);
  }
  if (headerBytes > 16_000) throw new InputError("Request headers are too large.");

  const body = payload.body === undefined ? undefined : typeof payload.body === "string" ? payload.body : null;
  if (body === null) throw new InputError("The request body must be text.");
  if (body !== undefined && Buffer.byteLength(body, "utf8") > 100_000) throw new InputError("The request body must be 100 KB or smaller.");

  return { method: rawMethod as HttpMethod, url, query, headers, body };
}

const ipv4BlockedRanges: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function ipv4Number(address: string): number {
  return address.split(".").reduce((value, part) => value * 256 + Number(part), 0);
}

function ipv4InRange(address: string, network: string, prefix: number): boolean {
  const width = 2 ** (32 - prefix);
  return Math.floor(ipv4Number(address) / width) === Math.floor(ipv4Number(network) / width);
}

function ipv6Number(address: string): bigint | null {
  let normalized = address.toLowerCase();
  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":");
    const ipv4 = normalized.slice(lastColon + 1);
    if (isIP(ipv4) !== 4) return null;
    const value = ipv4Number(ipv4);
    normalized = `${normalized.slice(0, lastColon)}:${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`;
  }
  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !ipv4BlockedRanges.some(([network, prefix]) => ipv4InRange(address, network, prefix));
  if (family !== 6 || address.includes("%")) return false;

  const numeric = ipv6Number(address);
  if (numeric === null) return false;
  if ((numeric >> 32n) === 0xffffn) {
    const embedded = Number(numeric & 0xffff_ffffn);
    const ipv4 = [24, 16, 8, 0].map((shift) => (embedded >>> shift) & 255).join(".");
    return isPublicAddress(ipv4);
  }
  // Only global-unicast IPv6 is allowed; this excludes loopback, link-local,
  // unique-local, multicast, NAT64, and other special-purpose ranges.
  if ((numeric >> 125n) !== 1n) return false;
  if ((numeric >> 96n) === 0x20010db8n) return false;
  if ((numeric >> 112n) === 0x2002n) return false;
  return true;
}

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const defaultResolver: HostResolver = async (hostname) => {
  if (isIP(hostname) === 4) return [{ address: hostname, family: 4 }];
  if (isIP(hostname) === 6) return [{ address: hostname, family: 6 }];
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address, family: record.family as 4 | 6 }));
};

export async function resolvePublicTarget(url: URL, resolver: HostResolver = defaultResolver): Promise<ResolvedAddress[]> {
  let records: ResolvedAddress[];
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    records = await Promise.race([
      resolver(url.hostname.replace(/^\[|\]$/g, "")),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("DNS lookup timed out")), 5_000); }),
    ]);
  } catch {
    throw new InputError("We couldn’t verify that destination host. Check the URL and try again.", 400);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  if (records.length === 0 || records.some((record) => !isPublicAddress(record.address))) {
    throw new InputError("This destination must resolve only to public internet addresses.", 400);
  }
  return records;
}

export type OutboundResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  contentType: string | null;
  body: string;
  bodyTruncated: boolean;
};

export function sendBoundedRequest(input: OutboundInput, addresses: ResolvedAddress[], maxResponseBytes = 1_000_000, timeoutMs = 15_000): Promise<OutboundResponse> {
  const transport = input.url.protocol === "https:" ? httpsRequest : httpRequest;
  const chosenAddress = addresses[0];
  const headers = Object.fromEntries(Object.entries(input.headers).map(([name, value]) => [name.toLowerCase(), value]));
  headers["accept-encoding"] = "identity";

  return new Promise((resolve, reject) => {
    let settled = false;
    let responseStatus = 0;
    let responseStatusText = "";
    let responseHeaders: Record<string, string> = {};
    let contentType: string | null = null;
    let byteLength = 0;
    let bodyTruncated = false;
    const chunks: Buffer[] = [];

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ status: responseStatus, statusText: responseStatusText, headers: responseHeaders, contentType, body: Buffer.concat(chunks).toString("utf8"), bodyTruncated });
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    const lookup = ((_hostname: string, options: { all?: boolean }, callback: (error: NodeJS.ErrnoException | null, address: string | Array<{ address: string; family: number }>, family?: number) => void) => {
      if (options?.all) callback(null, addresses);
      else callback(null, chosenAddress.address, chosenAddress.family);
    }) as never;

    const request = transport(input.url, {
      method: input.method,
      headers,
      lookup,
      agent: false,
      maxHeaderSize: 16_384,
    }, (response) => {
      responseStatus = response.statusCode ?? 502;
      responseStatusText = response.statusMessage ?? "";
      responseHeaders = Object.fromEntries(Object.entries(response.headers)
        .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
        .map(([name, value]) => [name, Array.isArray(value) ? value.join(", ") : value]));
      contentType = typeof response.headers["content-type"] === "string" ? response.headers["content-type"] : null;

      response.on("data", (chunk: Buffer | string) => {
        if (settled) return;
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const remaining = maxResponseBytes - byteLength;
        if (remaining > 0) {
          const kept = bytes.subarray(0, remaining);
          chunks.push(kept);
          byteLength += kept.byteLength;
        }
        if (bytes.byteLength > remaining) {
          bodyTruncated = true;
          finish();
          request.destroy();
        }
      });
      response.on("end", finish);
      response.on("error", (error) => {
        if (!bodyTruncated) fail(error);
      });
    });

    const timeout = setTimeout(() => request.destroy(new Error("The destination took too long to respond.")), timeoutMs);
    request.on("error", fail);
    request.end(["GET", "DELETE"].includes(input.method) ? undefined : input.body);
  });
}

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site";
  } catch {
    return false;
  }
}
