export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
};

export function readSmtpSettings(environment: Record<string, string | undefined> = process.env): SmtpSettings | null {
  const host = environment.SMTP_HOST?.trim() ?? "";
  const user = environment.SMTP_USER?.trim() ?? "";
  const password = environment.SMTP_PASSWORD ?? "";
  const from = environment.SMTP_FROM?.trim() ?? "";
  if (!host && !user && !password && !from) return null;
  if (!host || !from) throw new Error("SMTP_HOST and SMTP_FROM are required to send email.");
  if (Boolean(user) !== Boolean(password)) throw new Error("SMTP_USER and SMTP_PASSWORD must be configured together.");
  if (/[\r\n]/.test(from)) throw new Error("SMTP_FROM contains invalid characters.");

  const portValue = environment.SMTP_PORT?.trim() || "587";
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("SMTP_PORT must be a valid port number.");
  const secureValue = environment.SMTP_SECURE?.trim().toLowerCase();
  if (secureValue && secureValue !== "true" && secureValue !== "false") throw new Error("SMTP_SECURE must be true or false.");

  return { host, port, secure: secureValue ? secureValue === "true" : port === 465, user: user || undefined, password: password || undefined, from };
}
