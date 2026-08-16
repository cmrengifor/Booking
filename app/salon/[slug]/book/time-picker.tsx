"use client";

import { useRef } from "react";
import { DateTime } from "luxon";
import { cn } from "@/lib/utils";
import { AnalogClock } from "./analog-clock";

const START_HOUR = 8;
const END_HOUR = 20;
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
  const trackRef = useRef<HTMLDivElement>(null);

  const slotByLabel = new Map(
    slots.map((s) => [DateTime.fromISO(s).setZone(timezone).toFormat("HH:mm"), s])
  );
  const selectedLabel = selected
    ? DateTime.fromISO(selected).setZone(timezone).toFormat("HH:mm")
    : null;
  const availableHours = new Set(
    slots.map((s) => DateTime.fromISO(s).setZone(timezone).hour)
  );

  function scrollBy(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: 200 * direction, behavior: "smooth" });
  }

  function pickHour(hour: number) {
    const match = DAY_TICKS.find(
      (t) => t.hour === hour && slotByLabel.has(`${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`)
    );
    if (match) {
      const iso = slotByLabel.get(`${String(match.hour).padStart(2, "0")}:${String(match.minute).padStart(2, "0")}`);
      if (iso) onSelect(iso);
    }
  }

  return (
    <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
      <AnalogClock
        selectedHour={selectedLabel ? Number(selectedLabel.split(":")[0]) : null}
        availableHours={availableHours}
        onPickHour={pickHour}
      />

      <div className="relative min-w-0 flex-1">
        <p className="mb-2 font-sans text-xs text-muted-foreground">8:00 am – 8:00 pm</p>
        <div className="group/carousel relative">
          <div
            ref={trackRef}
            className="flex gap-2 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {DAY_TICKS.map((tick) => {
              const isAvailable = slotByLabel.has(tick.label);
              const isSelected = selectedLabel === tick.label;
              return (
                <button
                  key={tick.label}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => {
                    const iso = slotByLabel.get(tick.label);
                    if (iso) onSelect(iso);
                  }}
                  className={cn(
                    "shrink-0 rounded-md border px-3 py-2 font-mono text-xs whitespace-nowrap transition-colors",
                    isAvailable
                      ? "border-border text-foreground hover:border-gold"
                      : "border-border/40 text-muted-foreground/40",
                    isSelected && "border-gold bg-gold/10 text-gold"
                  )}
                >
                  {tick.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => scrollBy(-1)}
            className="absolute top-1/2 left-0 hidden -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background p-1.5 opacity-0 transition-opacity group-hover/carousel:opacity-100 sm:block"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => scrollBy(1)}
            className="absolute top-1/2 right-0 hidden translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background p-1.5 opacity-0 transition-opacity group-hover/carousel:opacity-100 sm:block"
          >
            ›
          </button>
        </div>
        <p className="mt-2 font-sans text-xs text-muted-foreground">
          <span className="mr-3 inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-full border border-border" /> Disponible
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-muted-foreground/30" /> No disponible
          </span>
        </p>
      </div>
    </div>
  );
}
