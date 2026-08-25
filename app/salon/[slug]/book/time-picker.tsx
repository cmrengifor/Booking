"use client";

import { useRef, type MouseEvent } from "react";
import { DateTime } from "luxon";
import { motion, useMotionValue, useSpring, type MotionStyle } from "motion/react";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const GLOW_SPRING = { stiffness: 180, damping: 22 } as const;

/**
 * An available time slot — the cursor-tracked radial glow is adapted from
 * kokonutui's Spotlight Cards (kokonutui.com/docs/cards/spotlight-cards),
 * trimmed down for a dense grid of small cells: no 3D tilt, no dimming
 * siblings, no shimmer sweep — those read as marketing-page flourish here,
 * not a functional picker for 20-40 cells on screen at once.
 */
function AvailableSlot({ label, selected }: { label: string; selected: boolean }) {
  const ref = useRef<HTMLLabelElement>(null);
  const glowX = useMotionValue("50%");
  const glowY = useMotionValue("50%");
  const glowOpacity = useSpring(0, GLOW_SPRING);

  function handleMouseMove(e: MouseEvent<HTMLLabelElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    glowX.set(`${((e.clientX - rect.left) / rect.width) * 100}%`);
    glowY.set(`${((e.clientY - rect.top) / rect.height) * 100}%`);
  }

  return (
    <label
      ref={ref}
      onMouseEnter={() => glowOpacity.set(1)}
      onMouseLeave={() => glowOpacity.set(0)}
      onMouseMove={handleMouseMove}
      className={cn(
        "relative flex min-h-11 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md border border-border px-2 py-2 font-mono text-xs whitespace-nowrap text-foreground transition-colors hover:border-gold",
        selected && "border-gold bg-gold/10 ring-2 ring-gold ring-offset-2 ring-offset-background"
      )}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={
          {
            opacity: glowOpacity,
            "--glow-x": glowX,
            "--glow-y": glowY,
            backgroundImage:
              "radial-gradient(circle at var(--glow-x) var(--glow-y), color-mix(in oklch, var(--gold) 40%, transparent) 0%, transparent 60%)",
          } as MotionStyle
        }
      />
      <RadioGroupItem value={label} className="sr-only" />
      <span className="relative z-10">{label}</span>
    </label>
  );
}

function UnavailableSlot({ label }: { label: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-11 cursor-not-allowed items-center justify-center rounded-md border border-border/50 bg-muted/40 px-2 py-2 font-mono text-xs whitespace-nowrap text-muted-foreground/50 line-through decoration-muted-foreground/30"
    >
      {label}
    </div>
  );
}

export function TimePicker({
  timezone,
  allSlots,
  availableSlots,
  selected,
  onSelect,
}: {
  timezone: string;
  /** Every slot position within the salon's hours for the day, available or not. */
  allSlots: string[];
  /** The subset of allSlots someone can actually be booked into right now. */
  availableSlots: string[];
  selected: string | null;
  onSelect: (isoStartsAt: string) => void;
}) {
  const availableSet = new Set(availableSlots);
  const selectedLabel = selected
    ? DateTime.fromISO(selected).setZone(timezone).toFormat("HH:mm")
    : null;

  if (allSlots.length === 0) {
    return (
      <div className="rounded-md border border-border p-4 font-sans text-sm text-muted-foreground">
        No hay horarios disponibles este día. Prueba otra fecha o elige &ldquo;cualquier
        artista disponible&rdquo;.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 font-sans text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-gold bg-gold/20" /> Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-border bg-muted/60" /> No disponible
        </span>
      </div>

      <RadioGroup
        value={selectedLabel ?? ""}
        onValueChange={(label) => {
          const iso = availableSlots.find(
            (s) => DateTime.fromISO(s).setZone(timezone).toFormat("HH:mm") === label
          );
          if (iso) onSelect(iso);
        }}
        className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4"
      >
        {allSlots.map((iso) => {
          const label = DateTime.fromISO(iso).setZone(timezone).toFormat("HH:mm");
          return availableSet.has(iso) ? (
            <AvailableSlot key={iso} label={label} selected={selectedLabel === label} />
          ) : (
            <UnavailableSlot key={iso} label={label} />
          );
        })}
      </RadioGroup>
    </div>
  );
}
