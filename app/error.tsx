"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * Route-segment error boundary — catches anything an app/ page or its
 * children throw and shows a branded fallback instead of Next.js's raw
 * default error screen. No error-monitoring account exists yet (Sentry or
 * similar needs Carlos to create one), so this is the stopgap: at minimum,
 * log with enough context to find in Vercel's own function logs, and don't
 * show a broken page to a real visitor.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(`[error-boundary] digest=${error.digest ?? "none"}`, error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">Algo salió mal</p>
      <h1 className="font-heading text-3xl text-foreground">No pudimos cargar esta página</h1>
      <p className="max-w-md font-sans text-sm text-muted-foreground">
        Ya quedó registrado el error. Intenta de nuevo — si sigue pasando, vuelve más tarde.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className={buttonVariants({ variant: "outline" })}
        >
          Reintentar
        </button>
        <Link href="/" className={buttonVariants({})}>
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
