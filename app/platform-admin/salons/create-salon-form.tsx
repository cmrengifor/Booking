"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createSalon } from "./actions";

export function CreateSalonForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await createSalon(formData);
      setMessage(result.error ?? "Salón creado.");
    });
  }

  return (
    <div className="rounded-md border border-border p-4">
      <h2 className="font-heading text-lg text-foreground">Crear salón</h2>
      <form action={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="font-sans text-[11px] text-muted-foreground">Nombre</label>
          <input
            name="name"
            required
            className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-sans text-[11px] text-muted-foreground">Slug</label>
          <input
            name="slug"
            required
            placeholder="mi-salon"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-sans text-[11px] text-muted-foreground">Zona horaria</label>
          <input
            name="timezone"
            required
            placeholder="America/Bogota"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button type="submit" size="xs" disabled={pending}>
          {pending ? "Creando…" : "Crear"}
        </Button>
      </form>
      {message && <p className="mt-2 font-sans text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
