"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordInputProps = {
  name: string;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
};

export default function PasswordInput({ name, autoComplete, required = false, minLength, maxLength }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return <div className="relative mt-1.5">
    <input
      name={name}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      required={required}
      minLength={minLength}
      maxLength={maxLength}
      className="h-11 w-full rounded-lg border border-slate-200 px-3 pr-11 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
    />
    <button
      type="button"
      onClick={() => setVisible((current) => !current)}
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
      className="absolute inset-y-0 right-1 inline-flex w-10 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-violet-600"
    >
      {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  </div>;
}
