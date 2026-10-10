import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

const scrypt = promisify(scryptCallback);
const cookieName = "manpost_session";
const sessionDuration = 7 * 24 * 60 * 60 * 1000;

export type CurrentUser = { id: string; email: string; name: string | null };

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDuration);
  const db = getDb();
  await db.session.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), userId, expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (!token) return null;
  const db = getDb();
  const session = await db.session.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    select: { expiresAt: true, user: { select: { id: true, email: true, name: true } } },
  });
  if (!session || session.expiresAt <= new Date()) {
    cookieStore.delete(cookieName);
    if (session) await db.session.deleteMany({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
    return null;
  }
  return session.user;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (token) await getDb().session.deleteMany({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
  cookieStore.delete(cookieName);
}
