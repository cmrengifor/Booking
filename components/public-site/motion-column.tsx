"use client";

import { Children, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A continuously-scrolling vertical column of cards — the same motion
 * family as MotionRow (see motion-row.tsx), turned 90°. Used for the
 * testimonial wall in reviews-section.tsx: unlike MotionRow (which owns
 * its own image cards), this one is content-agnostic — it just loops
 * whatever children it's given, so it can carry review cards, quotes,
 * or anything else.
 */
export function MotionColumn({
  children,
  direction = "up",
  gap = 16,
  cycleSeconds,
  pauseOnHover = true,
  edgeFadePercent = 16,
  className,
}: {
  children: ReactNode;
  direction?: "up" | "down";
  gap?: number;
  cycleSeconds?: number;
  pauseOnHover?: boolean;
  edgeFadePercent?: number;
  className?: string;
}) {
  const [paused, setPaused] = useState(false);
  const items = Children.toArray(children);

  if (!items.length) return null;

  // Doubled so the track can loop seamlessly at a -50% translate.
  const track = [...items, ...items];
  const duration = cycleSeconds ?? items.length * 3.6;
  const mask = `linear-gradient(to bottom, transparent, black ${edgeFadePercent}%, black ${100 - edgeFadePercent}%, transparent)`;

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined}
    >
      <div
        className="motion-column-track flex h-max flex-col"
        style={{
          gap,
          animationName: "motion-column-scroll",
          animationDuration: `${duration}s`,
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationDirection: direction === "down" ? "reverse" : "normal",
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {track.map((child, i) => (
          <div key={i}>{child}</div>
        ))}
      </div>
    </div>
  );
}
