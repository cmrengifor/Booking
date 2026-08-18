"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export type CarouselImage = {
  id: string;
  src: string;
  alt: string;
};

export function ImageCarousel({
  images,
  className,
  imageClassName,
}: {
  images: CarouselImage[];
  className?: string;
  imageClassName?: string;
}) {
  if (!images.length) return null;

  return (
    <Carousel
      opts={{ align: "start", dragFree: true }}
      className={cn("group/carousel", className)}
    >
      <CarouselContent>
        {images.map((img) => (
          <CarouselItem key={img.id} className="basis-[65%] sm:basis-[38%] lg:basis-[28%]">
            <div
              className={cn(
                "relative aspect-[4/5] w-full overflow-hidden rounded-sm",
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
          </CarouselItem>
        ))}
      </CarouselContent>
      {images.length > 1 && (
        <>
          <CarouselPrevious
            aria-label="Anterior"
            className="left-1 opacity-0 backdrop-blur-sm transition-opacity group-hover/carousel:opacity-100"
          />
          <CarouselNext
            aria-label="Siguiente"
            className="right-1 opacity-0 backdrop-blur-sm transition-opacity group-hover/carousel:opacity-100"
          />
        </>
      )}
    </Carousel>
  );
}
