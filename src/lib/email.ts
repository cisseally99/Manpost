import "server-only";
import nodemailer from "nodemailer";
import { readSmtpSettings } from "@/lib/email-settings";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const settings = readSmtpSettings();
  if (!settings) return false;

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    requireTLS: !settings.secure,
    auth: settings.user && settings.password ? { user: settings.user, pass: settings.password } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });

  await transporter.sendMail({
    from: settings.from,
    to,
    subject: "Reset your Manpost password",
    text: `We received a request to reset your Manpost password. Use this one-time link within 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<div style="margin:0;background:#f6f7fb;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#172033"><div style="max-width:520px;margin:0 auto;border:1px solid #e2e8f0;border-radius:18px;background:#fff;padding:32px"><p style="margin:0 0 8px;color:#5b4bdb;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Manpost</p><h1 style="margin:0 0 12px;font-size:24px">Reset your password</h1><p style="font-size:15px;line-height:1.6;color:#475569">We received a request to reset your Manpost password. This one-time link expires in 30 minutes.</p><p style="margin:24px 0"><a href="${resetUrl}" style="display:inline-block;border-radius:10px;background:#5b4bdb;padding:12px 18px;color:#fff;text-decoration:none;font-weight:700">Choose a new password</a></p><p style="font-size:13px;line-height:1.6;color:#64748b">If you did not request a password reset, you can ignore this email. Your current password will remain unchanged.</p></div></div>`,
  });
  return true;
}
