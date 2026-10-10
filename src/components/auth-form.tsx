"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register, type AuthState } from "@/app/actions/auth";
import ManpostLogo from "@/components/manpost-logo";
import PasswordInput from "@/components/password-input";

const initialState: AuthState = {};

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const action = mode === "login" ? login : register;
  const [state, formAction, pending] = useActionState(action, initialState);
  const isRegister = mode === "register";

  return <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4 py-12 text-slate-900">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <Link href="/login" className="inline-flex items-center gap-3">
        <ManpostLogo size={42} />
      </Link>
      <h1 className="mt-8 text-2xl font-bold tracking-tight">{isRegister ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">{isRegister ? "Save your requests securely and continue learning." : "Sign in to open your saved API requests."}</p>
      <form action={formAction} className="mt-6 space-y-4">
        {isRegister && <label className="block text-sm font-medium text-slate-700">Name <span className="font-normal text-slate-400">(optional)</span><input name="name" autoComplete="name" maxLength={80} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50" /></label>}
        <label className="block text-sm font-medium text-slate-700">Email<input required name="email" type="email" autoComplete="email" maxLength={254} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50" /></label>
        <label className="block text-sm font-medium text-slate-700">Password<PasswordInput required name="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 8 : undefined} maxLength={128} />{isRegister && <span className="mt-1 block text-xs font-normal text-slate-400">Use at least 8 characters.</span>}</label>
        {!isRegister && <div className="-mt-2 text-right"><Link href="/forgot-password" className="text-sm font-medium text-[var(--brand)] hover:underline">Forgot password?</Link></div>}
        {state.error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm leading-5 text-rose-700">{state.error}</p>}
        <button disabled={pending} className="h-11 w-full rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">{pending ? "Please wait…" : isRegister ? "Create account" : "Sign in"}</button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">{isRegister ? "Already have an account? " : "New to Manpost? "}<Link className="font-semibold text-[var(--brand)] hover:underline" href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
    </section>
  </main>;
}
