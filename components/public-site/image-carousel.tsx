"use client";

import { useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CarouselImage = {
  id: string;
  src: string;
  alt: string;
};

/**
 * Dependency-free horizontal carousel: native CSS scroll-snap for the
 * gesture (touch/trackpad scroll just works), arrow buttons as a fallback
 * for mouse/keyboard. Shared by the services and portfolio sections rather
 * than pulling in an embla/swiper dependency for a simple photo strip.
 */
export function ImageCarousel({
  images,
  className,
  imageClassName,
}: {
  images: CarouselImage[];
  className?: string;
  imageClassName?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (!images.length) return null;

  function scrollBy(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const amount = track.clientWidth * 0.8 * direction;
    track.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className={cn("group/carousel relative", className)}>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img) => (
          <div
            key={img.id}
            className={cn(
              "relative aspect-[4/5] w-[65%] shrink-0 snap-start overflow-hidden rounded-sm sm:w-[38%] lg:w-[28%]",
              imageClassName
            )}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(max-width: 640px) 65vw, (max-width: 1024px) 38vw, 28vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => scrollBy(-1)}
            className="absolute top-1/2 left-1 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover/carousel:opacity-100 sm:block"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => scrollBy(1)}
            className="absolute top-1/2 right-1 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover/carousel:opacity-100 sm:block"
          >
            <ChevronRight className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}
