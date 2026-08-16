"use client";

import { useState, useTransition } from "react";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

export function TriggerActionButton({
  action,
  appointmentId,
  slug,
  label,
  variant = "outline",
}: {
  action: (appointmentId: string, slug: string) => Promise<{ link: string }>;
  appointmentId: string;
  slug: string;
  label: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action(appointmentId, slug);
        setLink(result.link);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo enviar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" variant={variant} type="button" onClick={handleClick} disabled={pending}>
        {pending ? "Enviando…" : label}
      </Button>
      {link && (
        <p className="max-w-xs break-all font-sans text-xs text-muted-foreground">
          Enlace (demo, sin envío real —{" "}
          <a className="underline" href={link} target="_blank" rel="noreferrer">
            abrir
          </a>
          )
        </p>
      )}
      {error && <p className="font-sans text-xs text-destructive">{error}</p>}
    </div>
  );
}
