"use client";

import { useState, useTransition } from "react";
import { updateServiceSplit } from "./actions";

export function SplitInput({
  serviceId,
  slug,
  initialSplit,
}: {
  serviceId: string;
  slug: string;
  initialSplit: number;
}) {
  const [value, setValue] = useState(initialSplit);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleBlur() {
    if (value === initialSplit) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateServiceSplit(serviceId, value, slug);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <div className="flex items-center gap-2 font-sans text-xs text-muted-foreground">
      <span>Split — Artista</span>
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        disabled={pending}
        onChange={(e) => {
          setValue(Number(e.target.value));
          setSaved(false);
        }}
        onBlur={handleBlur}
        className="w-14 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
      />
      <span>% / Negocio {100 - value}%</span>
      {saved && <span className="text-foreground">Guardado</span>}
      {error && <span className="text-destructive">{error}</span>}
    </div>
  );
}
