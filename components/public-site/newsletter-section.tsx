"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Salon } from "@/lib/tenant/resolve-salon";
import { subscribeToNewsletter } from "@/app/salon/[slug]/newsletter-actions";

export function NewsletterSection({ salon }: { salon: Salon }) {
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <h3 className="font-sans text-sm font-medium text-foreground">
        Novedades de {salon.name}
      </h3>
      {status === "done" ? (
        <p className="mt-2 font-sans text-sm text-gold">Listo — ya estás suscrita.</p>
      ) : (
        <form
          action={(formData) => {
            startTransition(async () => {
              const result = await subscribeToNewsletter(salon.id, formData);
              setStatus(result.error ? "error" : "done");
            });
          }}
          className="mt-3 flex max-w-xs flex-col gap-2"
        >
          <input
            name="email"
            type="email"
            required
            placeholder="tu@correo.com"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" disabled={pending} size="sm">
            {pending ? "…" : "Suscribirme"}
          </Button>
          {status === "error" && (
            <p className="font-sans text-xs text-destructive">Intenta de nuevo.</p>
          )}
          <p className="font-sans text-[0.7rem] text-muted-foreground">
            Solo usamos tu correo para enviarte novedades.{" "}
            <Link href={`/salon/${salon.slug}/privacidad`} className="underline hover:text-foreground">
              Manejo de datos
            </Link>
            .
          </p>
        </form>
      )}
    </div>
  );
}
