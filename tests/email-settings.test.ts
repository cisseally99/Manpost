import assert from "node:assert/strict";
import test from "node:test";
import { readSmtpSettings } from "../src/lib/email-settings.ts";

test("SMTP stays disabled when only example defaults are present", () => {
  assert.equal(readSmtpSettings({ SMTP_HOST: "", SMTP_PORT: "587", SMTP_SECURE: "false", SMTP_USER: "", SMTP_PASSWORD: "", SMTP_FROM: "" }), null);
});

test("SMTP port 587 uses STARTTLS and accepts credentials", () => {
  const settings = readSmtpSettings({ SMTP_HOST: "smtp.example.com", SMTP_PORT: "587", SMTP_SECURE: "false", SMTP_USER: "user@example.com", SMTP_PASSWORD: "mail-secret", SMTP_FROM: "Manpost <no-reply@example.com>" });
  assert.equal(settings?.secure, false);
  assert.equal(settings?.port, 587);
  assert.equal(settings?.user, "user@example.com");
});

test("SMTP port 465 defaults to implicit TLS", () => {
  assert.equal(readSmtpSettings({ SMTP_HOST: "smtp.example.com", SMTP_PORT: "465", SMTP_FROM: "Manpost <no-reply@example.com>" })?.secure, true);
});

test("partial SMTP settings and invalid ports are rejected", () => {
  assert.throws(() => readSmtpSettings({ SMTP_HOST: "smtp.example.com" }), /SMTP_FROM/);
  assert.throws(() => readSmtpSettings({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "no-reply@example.com", SMTP_PORT: "70000" }), /SMTP_PORT/);
  assert.throws(() => readSmtpSettings({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "no-reply@example.com", SMTP_USER: "user@example.com" }), /SMTP_USER/);
});
