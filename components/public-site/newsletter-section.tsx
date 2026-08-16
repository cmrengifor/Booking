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
    <section className="border-t border-border bg-muted/30 px-6 py-16 sm:px-10">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <h2 className="font-heading text-2xl text-foreground">
          Novedades de {salon.name}
        </h2>
        {status === "done" ? (
          <p className="font-sans text-sm text-gold">Listo — ya estás suscrita.</p>
        ) : (
          <form
            action={(formData) => {
              startTransition(async () => {
                const result = await subscribeToNewsletter(salon.id, formData);
                setStatus(result.error ? "error" : "done");
              });
            }}
            className="flex w-full max-w-sm gap-2"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="tu@correo.com"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" disabled={pending}>
              {pending ? "…" : "Suscribirme"}
            </Button>
          </form>
        )}
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
      </div>
    </section>
  );
}
