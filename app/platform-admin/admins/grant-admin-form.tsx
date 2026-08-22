"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { grantPlatformAdmin } from "./actions";

export function GrantAdminForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await grantPlatformAdmin(formData);
      setMessage(result.error ?? "Acceso otorgado.");
    });
  }

  return (
    <div className="rounded-md border border-border p-4">
      <h2 className="font-heading text-lg text-foreground">Otorgar acceso</h2>
      <form action={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="font-sans text-[11px] text-muted-foreground">Correo</label>
          <input
            name="email"
            type="email"
            required
            className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button type="submit" size="xs" disabled={pending}>
          {pending ? "Otorgando…" : "Otorgar"}
        </Button>
      </form>
      <p className="mt-2 font-sans text-[11px] text-muted-foreground">
        La persona debe tener una cuenta creada ya con este correo.
      </p>
      {message && <p className="mt-1 font-sans text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
