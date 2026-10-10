"use server";

import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearSession, createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { checkClientRateLimit, checkRateLimit } from "@/lib/rate-limit";

export type AuthState = { error?: string };

export async function register(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: "Enter a valid email address." };
  if (password.length < 8 || password.length > 128) return { error: "Choose a password between 8 and 128 characters." };

  const clientRate = await checkClientRateLimit(await headers(), 10, 15 * 60_000);
  if (!clientRate.available) return { error: "Sign-up protection is temporarily unavailable. Please try again shortly." };
  if (!clientRate.allowed) return { error: "Too many sign-up attempts from this connection. Wait a little while and try again." };
  const signupKey = `auth:register:${createHash("sha256").update(email).digest("hex")}`;
  const signupRate = await checkRateLimit(signupKey, 5, 15 * 60_000);
  if (!signupRate.available) return { error: "Sign-up protection is temporarily unavailable. Please try again shortly." };
  if (!signupRate.allowed) return { error: "Too many sign-up attempts for this email. Wait a little while and try again." };

  try {
    const db = getDb();
    const user = await db.user.create({ data: { name: name || null, email, passwordHash: await hashPassword(password) }, select: { id: true } });
    await createSession(user.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "An account with that email already exists. Try signing in." };
    console.error("Account registration failed", error);
    return { error: error instanceof Error && error.message.includes("DATABASE_URL") ? error.message : "We could not create your account. Check your database setup and try again." };
  }
  redirect("/?welcome=created");
}

export async function login(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const clientRate = await checkClientRateLimit(await headers(), 30, 15 * 60_000);
  if (!clientRate.available) return { error: "Sign-in protection is temporarily unavailable. Please try again shortly." };
  if (!clientRate.allowed) return { error: "Too many sign-in attempts from this connection. Wait a little while and try again." };
  const loginKey = `auth:login:${createHash("sha256").update(email).digest("hex")}`;
  const loginRate = await checkRateLimit(loginKey, 10, 15 * 60_000);
  if (!loginRate.available) return { error: "Sign-in protection is temporarily unavailable. Please try again shortly." };
  if (!loginRate.allowed) return { error: "Too many sign-in attempts. Wait a little while and try again." };
  try {
    const db = getDb();
    const user = await db.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "Email or password is incorrect." };
    await createSession(user.id);
  } catch (error) {
    console.error("Sign-in failed", error);
    return { error: error instanceof Error && error.message.includes("DATABASE_URL") ? error.message : "We could not sign you in. Check your database setup and try again." };
  }
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
