"use server";

import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { hashPassword } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { getDb } from "@/lib/db";
import { createPasswordResetToken, getAppOrigin, hashPasswordResetToken, isPasswordResetTokenFormat, PASSWORD_RESET_LIFETIME_MS } from "@/lib/password-reset";
import { checkClientRateLimit, checkRateLimit } from "@/lib/rate-limit";

const genericRequestMessage = "If an account matches that email, password reset instructions will be sent shortly.";
const invalidLinkMessage = "This reset link is invalid or has expired. Request a new one and try again.";

export type PasswordResetRequestState = { message?: string; resetUrl?: string };
export type PasswordResetState = { error?: string; message?: string };

export async function requestPasswordReset(_previous: PasswordResetRequestState, formData: FormData): Promise<PasswordResetRequestState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { message: genericRequestMessage };

  const clientLimit = await checkClientRateLimit(await headers(), 10, 15 * 60_000);
  if (!clientLimit.available) return { message: "Password recovery is temporarily unavailable. Please try again shortly." };
  if (!clientLimit.allowed) return { message: "Too many recovery requests from this connection. Please wait and try again." };
  const emailKey = `password-reset:${createHash("sha256").update(email).digest("hex")}`;
  const emailLimit = await checkRateLimit(emailKey, 3, 15 * 60_000);
  const globalLimit = emailLimit.available
    ? await checkRateLimit("password-reset:global", 100, 15 * 60_000)
    : emailLimit;
  if (!emailLimit.available || !globalLimit.available) return { message: "Password recovery is temporarily unavailable. Please try again shortly." };
  if (!emailLimit.allowed || !globalLimit.allowed) {
    return { message: "Too many reset requests were made. Please wait a little while, then try again." };
  }

  try {
    const db = getDb();
    const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) return { message: genericRequestMessage };

    const origin = getAppOrigin();
    const { token, tokenHash } = createPasswordResetToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_LIFETIME_MS);
    await db.$transaction([
      db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      db.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
    ]);

    const resetUrl = new URL("/reset-password", origin);
    resetUrl.searchParams.set("token", token);
    let emailSent = false;
    try {
      emailSent = await sendPasswordResetEmail(user.email, resetUrl.toString());
    } catch (error) {
      console.error("Password reset email delivery failed", error instanceof Error ? error.name : "Unknown error");
    }

    if (!emailSent && process.env.NODE_ENV !== "production") {
      return { message: "Email delivery is not configured for this development app. Use this local reset link:", resetUrl: resetUrl.toString() };
    }
    if (!emailSent) console.error("Password reset email was not sent because SMTP is not configured.");
    return { message: genericRequestMessage };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) console.error("Password reset request could not be completed.");
    return { message: genericRequestMessage };
  }
}

export async function resetPassword(_previous: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");
  if (!isPasswordResetTokenFormat(token)) return { error: invalidLinkMessage };
  if (password.length < 8 || password.length > 128) return { error: "Choose a password between 8 and 128 characters." };
  if (password !== confirmation) return { error: "The passwords do not match." };

  const clientLimit = await checkClientRateLimit(await headers(), 10, 15 * 60_000);
  if (!clientLimit.available) return { error: "Password recovery is temporarily unavailable. Please try again shortly." };
  if (!clientLimit.allowed) return { error: invalidLinkMessage };
  const rate = await checkRateLimit(`password-reset-use:${hashPasswordResetToken(token)}`, 5, 15 * 60_000);
  if (!rate.available) return { error: "Password recovery is temporarily unavailable. Please try again shortly." };
  if (!rate.allowed) return { error: invalidLinkMessage };

  try {
    const db = getDb();
    const tokenHash = hashPasswordResetToken(token);
    const record = await db.passwordResetToken.findUnique({ where: { tokenHash }, select: { userId: true, expiresAt: true } });
    if (!record || record.expiresAt <= new Date()) return { error: invalidLinkMessage };

    const passwordHash = await hashPassword(password);
    await db.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.deleteMany({ where: { tokenHash, expiresAt: { gt: new Date() } } });
      if (consumed.count !== 1) throw new Error("RESET_TOKEN_ALREADY_USED");
      await transaction.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await transaction.session.deleteMany({ where: { userId: record.userId } });
      await transaction.passwordResetToken.deleteMany({ where: { userId: record.userId } });
    });
    return { message: "Your password has been changed. You can now sign in with the new password." };
  } catch {
    return { error: invalidLinkMessage };
  }
}
