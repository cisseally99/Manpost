"use client";

import Link from "next/link";
import { useActionState } from "react";
import ManpostLogo from "@/components/manpost-logo";
import PasswordInput from "@/components/password-input";
import { requestPasswordReset, resetPassword, type PasswordResetRequestState, type PasswordResetState } from "@/app/actions/password-reset";

const initialRequestState: PasswordResetRequestState = {};
const initialResetState: PasswordResetState = {};

function AuthCard({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4 py-12 text-slate-900">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <Link href="/login" aria-label="Manpost sign in" className="inline-flex rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600">
        <ManpostLogo size={42} />
      </Link>
      {children}
    </section>
  </main>;
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialRequestState);

  return <AuthCard>
    <h1 className="mt-8 text-2xl font-bold tracking-tight">Forgot your password?</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">Enter the email address for your Manpost account. If it matches an account, we’ll send reset instructions.</p>
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block text-sm font-medium text-slate-700">Email<input required name="email" type="email" autoComplete="email" maxLength={254} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50" /></label>
      {state.message && <div role="status" aria-live="polite" className="rounded-lg bg-violet-50 p-3 text-sm leading-5 text-violet-900"><p>{state.message}</p>{state.resetUrl && <Link href={state.resetUrl} className="mt-2 inline-block font-semibold underline underline-offset-2">Open the local password reset page</Link>}</div>}
      <button disabled={pending} className="h-11 w-full rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">{pending ? "Sending…" : "Send reset instructions"}</button>
    </form>
    <p className="mt-5 text-center text-sm text-slate-500"><Link className="font-semibold text-[var(--brand)] hover:underline" href="/login">Back to sign in</Link></p>
  </AuthCard>;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, initialResetState);

  return <AuthCard>
    <h1 className="mt-8 text-2xl font-bold tracking-tight">Choose a new password</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">Your reset link can only be used once and expires after 30 minutes.</p>
    {state.message ? <div role="status" aria-live="polite" className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><p>{state.message}</p><Link className="mt-2 inline-block font-semibold text-[var(--brand)] underline underline-offset-2" href="/login">Go to sign in</Link></div> : <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm font-medium text-slate-700">New password<PasswordInput required name="password" autoComplete="new-password" minLength={8} maxLength={128} /><span className="mt-1 block text-xs font-normal text-slate-400">Use 8 to 128 characters.</span></label>
      <label className="block text-sm font-medium text-slate-700">Confirm new password<PasswordInput required name="confirmPassword" autoComplete="new-password" minLength={8} maxLength={128} /></label>
      {state.error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm leading-5 text-rose-700">{state.error}</p>}
      <button disabled={pending} className="h-11 w-full rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">{pending ? "Updating password…" : "Update password"}</button>
    </form>}
    {!state.message && <p className="mt-5 text-center text-sm text-slate-500"><Link className="font-semibold text-[var(--brand)] hover:underline" href="/forgot-password">Request a fresh reset link</Link></p>}
  </AuthCard>;
}
