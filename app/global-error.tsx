"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary — only fires if the root layout itself throws
 * (error.tsx doesn't catch that, since it renders inside the layout it's
 * meant to guard). Replaces the whole document, so it needs its own
 * html/body unlike every other page in this app. Deliberately plain,
 * inline-styled: this is the one place we can't assume Tailwind/fonts from
 * the root layout loaded successfully.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(`[global-error-boundary] digest=${error.digest ?? "none"}`, error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem" }}>Algo salió mal</h1>
        <p style={{ color: "#666", maxWidth: 420 }}>
          Ya quedó registrado el error. Recarga la página o vuelve más tarde.
        </p>
      </body>
    </html>
  );
}
