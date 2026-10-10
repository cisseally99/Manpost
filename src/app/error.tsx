"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-6 py-12 text-[#172033]">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#5b4bdb]">
          Manpost
        </p>
        <h1 className="mt-4 text-2xl font-bold">That didn’t go as planned</h1>
        <p className="mt-3 leading-7 text-slate-600">
          This part of Manpost hit an unexpected problem. Your account data is
          still safe. You can try loading this page again.
        </p>
        {error.digest ? (
          <p className="mt-4 text-sm text-slate-500">
            Error reference: <code>{error.digest}</code>
          </p>
        ) : null}
        <button
          className="mt-6 rounded-lg bg-[#5b4bdb] px-5 py-3 font-semibold text-white hover:bg-[#4335b5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4335b5]"
          onClick={() => retry()}
          type="button"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
