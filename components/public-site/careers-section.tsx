"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Salon } from "@/lib/tenant/resolve-salon";
import { applyForJob } from "@/app/salon/[slug]/careers-actions";

export function CareersSection({ salon }: { salon: Salon }) {
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (status === "done") {
    return (
      <div>
        <h3 className="font-sans text-sm font-medium text-foreground">Trabaja con nosotros</h3>
        <p className="mt-2 font-sans text-sm text-gold">
          Listo — recibimos tu aplicación.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-sans text-sm font-medium text-foreground">Trabaja con nosotros</h3>
      <form
        ref={formRef}
        action={(formData) => {
          startTransition(async () => {
            const result = await applyForJob(salon.id, formData);
            if (result.error) {
              setErrorMsg(result.error);
              setStatus("error");
            } else {
              setStatus("done");
            }
          });
        }}
        className="mt-3 flex max-w-xs flex-col gap-2"
      >
        <input
          name="full_name"
          required
          placeholder="Nombre completo"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="tu@correo.com"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          name="resume"
          type="file"
          required
          accept=".pdf,.doc,.docx"
          className="font-sans text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-input file:bg-background file:px-2 file:py-1 file:text-xs file:text-foreground"
        />
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Enviando…" : "Aplicar"}
        </Button>
        <p className="font-sans text-[0.7rem] text-muted-foreground">
          Tus datos se usan solo para evaluar tu aplicación.{" "}
          <Link href={`/salon/${salon.slug}/privacidad`} className="underline hover:text-foreground">
            Manejo de datos
          </Link>
          .
        </p>
        {status === "error" && errorMsg && (
          <p className="font-sans text-xs text-destructive">{errorMsg}</p>
        )}
      </form>
    </div>
  );
}
