import nodemailer from "nodemailer";
import { readSmtpSettings } from "../src/lib/email-settings.ts";

try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

try {
  const settings = readSmtpSettings();
  if (!settings) {
    console.error("SMTP check skipped: configure SMTP_HOST and SMTP_FROM first.");
    process.exitCode = 2;
  } else {
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
    await transporter.verify();
    console.log("SMTP connection and authentication succeeded. No email was sent.");
    transporter.close();
  }
} catch (error) {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
  console.error("SMTP check failed:", code ?? (error instanceof Error ? error.name : "Unknown error"));
  process.exitCode = 1;
}
