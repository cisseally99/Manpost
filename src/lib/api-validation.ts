import { HTTP_METHODS, InputError, isPlainObject, type KeyValueRow } from "./request-security.ts";

export type PersistedRequestInput = {
  method: (typeof HTTP_METHODS)[number];
  url: string;
  params: KeyValueRow[];
  headers: KeyValueRow[];
  body: string;
};

export function validateRows(value: unknown): value is KeyValueRow[] {
  if (!Array.isArray(value) || value.length > 100) return false;
  let size = 0;
  for (const row of value) {
    if (!isPlainObject(row) || !Number.isSafeInteger(row.id) || typeof row.key !== "string" || row.key.length > 256 || typeof row.value !== "string" || row.value.length > 2048 || typeof row.enabled !== "boolean") return false;
    size += Buffer.byteLength(row.key) + Buffer.byteLength(row.value);
  }
  return size <= 24_000;
}

function validateUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return false;
  const variablePattern = /\{\{[\w.-]+\}\}/g;
  let candidate = value.trim().replace(/^\{\{[\w.-]+\}\}(?=[/?#]|$)/, "https://manpost.example");
  candidate = candidate.replace(variablePattern, "manpost-placeholder");
  if (/[{}]/.test(candidate)) return false;
  try {
    const url = new URL(candidate);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validatePersistedRequest(payload: unknown): PersistedRequestInput {
  if (!isPlainObject(payload)) throw new InputError("Request details must be a JSON object.");
  const method = typeof payload.method === "string" ? payload.method.toUpperCase() : "";
  if (!HTTP_METHODS.includes(method as PersistedRequestInput["method"])) throw new InputError("Choose a supported HTTP method.");
  if (!validateUrl(payload.url)) throw new InputError("Enter a valid HTTP or HTTPS URL.");
  if (!validateRows(payload.params) || !validateRows(payload.headers)) throw new InputError("Query parameters or headers are invalid or too large.");
  if (payload.body !== undefined && typeof payload.body !== "string") throw new InputError("The request body must be text.");
  const body = typeof payload.body === "string" ? payload.body : "";
  if (Buffer.byteLength(body) > 100_000) throw new InputError("The request body must be 100 KB or smaller.");
  return { method: method as PersistedRequestInput["method"], url: payload.url.trim(), params: payload.params, headers: payload.headers, body };
}

export function validateHistoryMetadata(payload: unknown): { status: number | null; responseTimeMs: number | null } {
  if (!isPlainObject(payload)) throw new InputError("History details must be a JSON object.");
  const status = payload.status === null || payload.status === undefined ? null : payload.status;
  const responseTimeMs = payload.responseTimeMs === null || payload.responseTimeMs === undefined ? null : payload.responseTimeMs;
  if (status !== null && (!Number.isInteger(status) || (status as number) < 100 || (status as number) > 599)) throw new InputError("The response status is invalid.");
  if (responseTimeMs !== null && (!Number.isInteger(responseTimeMs) || (responseTimeMs as number) < 0 || (responseTimeMs as number) > 60_000)) throw new InputError("The response time is invalid.");
  return { status: status as number | null, responseTimeMs: responseTimeMs as number | null };
}
