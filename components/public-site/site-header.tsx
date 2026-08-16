import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Salon } from "@/lib/tenant/resolve-salon";

export function SiteHeader({ salon }: { salon: Salon }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/80 px-6 py-4 backdrop-blur-md sm:px-10">
      <Link
        href={`/salon/${salon.slug}`}
        className="font-heading text-lg italic text-foreground"
      >
        {salon.name}
      </Link>
      <nav className="flex items-center gap-6 font-sans text-sm">
        <a href="#servicios" className="hidden text-muted-foreground hover:text-foreground sm:inline">
          Servicios
        </a>
        <a href="#portfolio" className="hidden text-muted-foreground hover:text-foreground sm:inline">
          Portfolio
        </a>
        <a href="#equipo" className="hidden text-muted-foreground hover:text-foreground sm:inline">
          Equipo
        </a>
        <Link
          href={`/salon/${salon.slug}/account`}
          className="hidden text-muted-foreground hover:text-foreground sm:inline"
        >
          Mi cuenta
        </Link>
        <Link href={`/salon/${salon.slug}/book`} className={buttonVariants({ size: "sm" })}>
          Reservar
        </Link>
      </nav>
    </header>
  );
}
