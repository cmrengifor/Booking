"use client";

import { DateTime } from "luxon";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const START_HOUR = 8;
const END_HOUR = 22;
const STEP_MINUTES = 15;

function buildDayTicks() {
  const ticks: { hour: number; minute: number; label: string }[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += STEP_MINUTES) {
      ticks.push({ hour: h, minute: m, label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` });
    }
  }
  return ticks;
}
const DAY_TICKS = buildDayTicks();

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
  const slotByLabel = new Map(
    slots.map((s) => [DateTime.fromISO(s).setZone(timezone).toFormat("HH:mm"), s])
  );
  const selectedLabel = selected
    ? DateTime.fromISO(selected).setZone(timezone).toFormat("HH:mm")
    : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="font-sans text-xs text-muted-foreground">8:00 am – 10:00 pm</p>
      <RadioGroup
        value={selectedLabel ?? undefined}
        onValueChange={(label) => {
          const iso = slotByLabel.get(String(label));
          if (iso) onSelect(iso);
        }}
        className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4"
      >
        {DAY_TICKS.map((tick) => {
          const isAvailable = slotByLabel.has(tick.label);
          return (
            <label
              key={tick.label}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-2 font-mono text-xs whitespace-nowrap text-white transition-colors",
                isAvailable
                  ? "border-green-600 bg-green-600 hover:bg-green-700"
                  : "cursor-not-allowed border-red-500/60 bg-red-500/60 opacity-70",
                selectedLabel === tick.label && "ring-2 ring-gold ring-offset-2 ring-offset-background"
              )}
            >
              <RadioGroupItem
                value={tick.label}
                disabled={!isAvailable}
                className="sr-only"
              />
              {tick.label}
            </label>
          );
        })}
      </RadioGroup>
      <p className="font-sans text-xs text-muted-foreground">
        <span className="mr-3 inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-green-600" /> Disponible
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-red-500" /> No disponible
        </span>
      </p>
    </div>
  );
}
