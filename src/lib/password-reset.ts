import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";

export const PASSWORD_RESET_LIFETIME_MS = 30 * 60 * 1000;

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function isPasswordResetTokenFormat(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getAppOrigin() {
  const configuredUrl = process.env.APP_URL?.trim();
  const value = configuredUrl || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  if (!value) throw new Error("APP_URL must be configured before sending password reset emails.");

  const url = new URL(value);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("APP_URL must be a site origin without credentials, a path, or query parameters.");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("APP_URL must use HTTPS in production.");
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("APP_URL must use HTTP or HTTPS.");
  return url.origin;
}

export async function isUsablePasswordResetToken(token: string) {
  if (!isPasswordResetTokenFormat(token)) return false;
  const record = await getDb().passwordResetToken.findUnique({
    where: { tokenHash: hashPasswordResetToken(token) },
    select: { expiresAt: true },
  });
  return Boolean(record && record.expiresAt > new Date());
}
