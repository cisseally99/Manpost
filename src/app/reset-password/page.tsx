import type { Metadata } from "next";
import Link from "next/link";
import ManpostLogo from "@/components/manpost-logo";
import { ResetPasswordForm } from "@/components/password-reset-forms";
import { isUsablePasswordResetToken } from "@/lib/password-reset";

export const metadata: Metadata = {
  title: "Reset password | Manpost",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (typeof token === "string" && await isUsablePasswordResetToken(token)) return <ResetPasswordForm token={token} />;

  return <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4 py-12 text-slate-900">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <Link href="/login" aria-label="Manpost sign in" className="inline-flex"><ManpostLogo size={42} /></Link>
      <h1 className="mt-8 text-2xl font-bold tracking-tight">Reset link unavailable</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">This reset link is invalid, expired, or has already been used. Request a new one to continue.</p>
      <Link href="/forgot-password" className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-dark)]">Request a new link</Link>
    </section>
  </main>;
}
