"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Visual companion to the time carousel, not the primary input (per product
 * decision: carousel is the main interaction, this is a plus). 8am–8pm maps
 * onto the 12 face positions like a real clock; the hand points at the
 * hovered hour (falling back to the selected one) and the numbers are
 * clickable shortcuts to the nearest hour.
 */
export function AnalogClock({
  selectedHour,
  availableHours,
  onPickHour,
}: {
  selectedHour: number | null;
  availableHours: Set<number>;
  onPickHour: (hour: number) => void;
}) {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const hours = Array.from({ length: 12 }, (_, i) => 8 + i); // 8..19, 20 sits at 12 o'clock too
  const center = 60;
  const radius = 48;

  const handHour = hoveredHour ?? selectedHour ?? 8;
  const handAngle = ((handHour - 8) / 12) * 360 - 90;
  const handRad = (handAngle * Math.PI) / 180;
  const handX = center + radius * 0.7 * Math.cos(handRad);
  const handY = center + radius * 0.7 * Math.sin(handRad);

  return (
    <svg
      viewBox="0 0 120 120"
      className="mx-auto size-40 sm:size-48"
      role="img"
      aria-label="Selector de hora tipo reloj analógico"
      onMouseLeave={() => setHoveredHour(null)}
    >
      <circle cx={center} cy={center} r={radius} className="fill-muted/40 stroke-border" strokeWidth={1} />
      {hours.map((hour, i) => {
        const angle = (i / 12) * 360 - 90;
        const rad = (angle * Math.PI) / 180;
        const x = center + radius * 0.8 * Math.cos(rad);
        const y = center + radius * 0.8 * Math.sin(rad);
        const available = availableHours.has(hour);
        const isSelected = selectedHour === hour;
        const label = hour > 12 ? hour - 12 : hour;
        return (
          <text
            key={hour}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            onClick={() => available && onPickHour(hour)}
            onMouseEnter={() => available && setHoveredHour(hour)}
            className={cn(
              "font-mono text-[9px] select-none",
              available ? "cursor-pointer fill-green-600 dark:fill-green-400" : "fill-red-400/60",
              isSelected && "fill-gold font-bold"
            )}
          >
            {label}
          </text>
        );
      })}
      <line
        x1={center}
        y1={center}
        x2={handX}
        y2={handY}
        className="stroke-gold"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx={center} cy={center} r={2.5} className="fill-gold" />
    </svg>
  );
}
