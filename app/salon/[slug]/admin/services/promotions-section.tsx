"use client";

import { useState, useTransition } from "react";
import { DateTime } from "luxon";
import { Button } from "@/components/ui/button";
import { createPromotion, deletePromotion } from "./actions";

type Promotion = {
  id: string;
  discount_percent: number;
  starts_at: string;
  ends_at: string;
};

export function PromotionsSection({
  serviceId,
  salonId,
  slug,
  timezone,
  promotions,
}: {
  serviceId: string;
  salonId: string;
  slug: string;
  timezone: string;
  promotions: Promotion[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const now = DateTime.now();
  function status(p: Promotion) {
    const starts = DateTime.fromISO(p.starts_at);
    const ends = DateTime.fromISO(p.ends_at);
    if (now < starts) return "Próxima";
    if (now > ends) return "Finalizada";
    return "Activa";
  }

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createPromotion(serviceId, salonId, slug, formData);
      if (result.error) setError(result.error);
    });
  }

  function handleDelete(id: string) {
    startTransition(() => deletePromotion(id, slug));
  }

  return (
    <div className="rounded-md border border-dashed border-border/70 px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-sans text-xs font-medium text-foreground"
      >
        Promociones ({promotions.length}) {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {promotions.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 font-sans text-xs">
              <span className="text-foreground">
                {p.discount_percent}% ·{" "}
                {DateTime.fromISO(p.starts_at).setZone(timezone).setLocale("es").toFormat("d LLL")} –{" "}
                {DateTime.fromISO(p.ends_at).setZone(timezone).setLocale("es").toFormat("d LLL")} ·{" "}
                <span className="text-muted-foreground">{status(p)}</span>
              </span>
              <Button
                variant="ghost"
                size="xs"
                type="button"
                disabled={pending}
                onClick={() => handleDelete(p.id)}
              >
                Quitar
              </Button>
            </div>
          ))}
          {!promotions.length && (
            <p className="font-sans text-xs text-muted-foreground">Sin promociones.</p>
          )}
          <form action={handleCreate} className="mt-1 flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[11px] text-muted-foreground">Descuento %</label>
              <input
                name="discount_percent"
                type="number"
                min={1}
                max={90}
                required
                className="w-20 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[11px] text-muted-foreground">Desde</label>
              <input
                name="starts_at"
                type="date"
                required
                className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[11px] text-muted-foreground">Hasta</label>
              <input
                name="ends_at"
                type="date"
                required
                className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" size="xs" disabled={pending}>
              Agregar
            </Button>
          </form>
          {error && <p className="font-sans text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
