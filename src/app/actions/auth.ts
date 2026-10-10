"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { clearSession, createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export type AuthState = { error?: string };

export async function register(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: "Enter a valid email address." };
  if (password.length < 8 || password.length > 128) return { error: "Choose a password between 8 and 128 characters." };

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
