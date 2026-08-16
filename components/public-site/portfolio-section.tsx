import Image from "next/image";
import { Reveal } from "./reveal";
import type { Tables } from "@/types/database";

type PortfolioItem = Tables<"portfolio_items">;

// Asymmetric rhythm, not a uniform card grid — every third tile runs tall.
const SPAN_PATTERN = ["row-span-2", "", "", "row-span-2", "", ""];

export function PortfolioSection({ items }: { items: PortfolioItem[] }) {
  if (!items.length) return null;

  return (
    <section id="portfolio" className="bg-foreground px-6 py-24 text-background sm:px-10 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-12 font-heading text-4xl italic sm:text-5xl">Portfolio</h2>
        <div className="grid auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[220px] sm:grid-cols-3 sm:gap-4">
          {items.map((item, i) => (
            <Reveal
              key={item.id}
              className={`relative overflow-hidden rounded-sm ${SPAN_PATTERN[i % SPAN_PATTERN.length]}`}
            >
              <Image
                src={item.image_url}
                alt={item.title ?? ""}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
