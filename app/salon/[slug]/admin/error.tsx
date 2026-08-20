"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Scoped to the admin route tree — sits inside AdminLayout, so a failed
 * query on any admin page (analytics/appointments/customers/services/
 * staff/reviews) now replaces just this segment's content instead of
 * bubbling to the root error.tsx and ejecting staff from the nav/toaster
 * shell entirely. Does NOT catch errors thrown by AdminLayout itself
 * (auth/membership resolution) — those still hit the root boundary, which
 * is correct, since there's no admin shell to keep mounted in that case.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="font-sans text-xs tracking-[0.3em] text-destructive uppercase">
        Error
      </p>
      <h1 className="font-heading text-2xl text-foreground">
        No pudimos cargar esta sección
      </h1>
      <p className="max-w-md font-sans text-sm text-muted-foreground">
        Hubo un problema al cargar estos datos. Puedes intentar de nuevo.
      </p>
      <Button onClick={reset} className="mt-2">
        Reintentar
      </Button>
    </div>
  );
}
