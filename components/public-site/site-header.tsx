"use client";

import Link from "next/link";
import type { Salon } from "@/lib/tenant/resolve-salon";

export function SiteHeader({ salon }: { salon: Salon }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/80 px-6 py-4 backdrop-blur-md sm:px-10">
      <Link
        href={`/salon/${salon.slug}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="font-heading text-lg italic text-foreground"
      >
        {salon.name}
      </Link>
      <nav className="flex items-center gap-6 font-sans text-sm">
        {/* Route-prefixed so it works from any page, not just the landing
            itself — a bare "#servicios" href only rewrites the hash of
            whatever page you're already on. */}
        <Link
          href={`/salon/${salon.slug}#servicios`}
          className="hidden text-muted-foreground hover:text-foreground sm:inline"
        >
          Servicios
        </Link>
        <Link
          href={`/salon/${salon.slug}/portfolio`}
          className="hidden text-muted-foreground hover:text-foreground sm:inline"
        >
          Obras de Arte
        </Link>
        <Link
          href={`/salon/${salon.slug}/account`}
          className="text-muted-foreground hover:text-foreground"
        >
          Mi cuenta
        </Link>
      </nav>
    </header>
  );
}
