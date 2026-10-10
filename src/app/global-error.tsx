"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#f6f7fb",
          color: "#172033",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px",
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: "480px",
              padding: "32px",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              background: "white",
            }}
          >
            <p style={{ color: "#5b4bdb", fontWeight: 700 }}>Manpost</p>
            <h1>Manpost needs to reload</h1>
            <p style={{ lineHeight: 1.6, color: "#475569" }}>
              An unexpected problem interrupted the app. Your account data is
              still safe. Try loading the app again.
            </p>
            {error.digest ? (
              <p style={{ color: "#64748b", fontSize: "14px" }}>
                Error reference: {error.digest}
              </p>
            ) : null}
            <button
              onClick={() => retry()}
              style={{
                marginTop: "12px",
                padding: "12px 20px",
                border: 0,
                borderRadius: "8px",
                background: "#5b4bdb",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
              type="button"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
