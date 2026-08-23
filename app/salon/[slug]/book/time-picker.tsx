"use client";

import { DateTime } from "luxon";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function TimePicker({
  timezone,
  slots,
  selected,
  onSelect,
}: {
  timezone: string;
  slots: string[];
  selected: string | null;
  onSelect: (isoStartsAt: string) => void;
}) {
  const selectedLabel = selected
    ? DateTime.fromISO(selected).setZone(timezone).toFormat("HH:mm")
    : null;

  if (slots.length === 0) {
    return (
      <div className="rounded-md border border-border p-4 font-sans text-sm text-muted-foreground">
        No hay horarios disponibles este día. Prueba otra fecha o elige &ldquo;cualquier
        artista disponible&rdquo;.
      </div>
    );
  }

  return (
    <RadioGroup
      value={selectedLabel ?? undefined}
      onValueChange={(label) => {
        const iso = slots.find((s) => DateTime.fromISO(s).setZone(timezone).toFormat("HH:mm") === label);
        if (iso) onSelect(iso);
      }}
      className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4"
    >
      {slots.map((iso) => {
        const label = DateTime.fromISO(iso).setZone(timezone).toFormat("HH:mm");
        return (
          <label
            key={iso}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-2 py-2 font-mono text-xs whitespace-nowrap text-foreground transition-colors hover:border-gold",
              selectedLabel === label && "border-gold ring-2 ring-gold ring-offset-2 ring-offset-background"
            )}
          >
            <RadioGroupItem value={label} className="sr-only" />
            {label}
          </label>
        );
      })}
    </RadioGroup>
  );
}
