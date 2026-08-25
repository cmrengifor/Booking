"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export type MotionRowItem = {
  id: string;
  src: string;
  alt: string;
};

/**
 * A continuously-scrolling row of cards with a staggered entrance and a
 * fade at both edges — same family as the horizonx.so "Motion Row" tool
 * (direction / card width / gap / corner radius / edge fade / timing are
 * all exposed as props here for the same reason that tool exposes them as
 * settings). The track scroll is linear (constant speed, no visible seam
 * at the loop point); only the per-card entrance uses an eased curve.
 */
export function MotionRow({
  items,
  direction = "left",
  cardWidth = 260,
  gap = 18,
  cornerRadius = 2,
  edgeFadePercent = 18,
  cycleSeconds,
  pauseOnHover = true,
  className,
  imageClassName,
}: {
  items: MotionRowItem[];
  direction?: "left" | "right";
  cardWidth?: number;
  gap?: number;
  cornerRadius?: number;
  edgeFadePercent?: number;
  /** Total seconds for one full loop of the (deduplicated) sequence. Defaults to ~3.2s/card. */
  cycleSeconds?: number;
  pauseOnHover?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  const [paused, setPaused] = useState(false);

  if (!items.length) return null;

  // Doubled so the track can loop seamlessly at a -50% translate.
  const track = [...items, ...items];
  const duration = cycleSeconds ?? items.length * 3.2;
  const mask = `linear-gradient(to right, transparent, black ${edgeFadePercent}%, black ${100 - edgeFadePercent}%, transparent)`;

  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined}
    >
      <div
        className="motion-row-track flex w-max"
        style={{
          gap,
          animationName: "motion-row-scroll",
          animationDuration: `${duration}s`,
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationDirection: direction === "right" ? "reverse" : "normal",
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {track.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            className={cn("relative aspect-[4/5] shrink-0 overflow-hidden opacity-0", imageClassName)}
            style={{
              width: cardWidth,
              borderRadius: cornerRadius,
              animationName: "motion-row-in",
              animationDuration: "700ms",
              animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              animationDelay: `${(i % items.length) * 0.06}s`,
              animationFillMode: "forwards",
            }}
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              sizes={`${cardWidth}px`}
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
