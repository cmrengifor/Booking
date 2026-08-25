"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Salon } from "@/lib/tenant/resolve-salon";
import { getSocialLinks, SOCIAL_LABELS } from "@/lib/social-links";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import SwitchButton from "@/components/kokonutui/switch-button";
import { ShareButton } from "./share-button";
import { BookingTrigger } from "./booking-trigger";

export function SiteHeader({
  salon,
  isStaff = false,
  isPlatformAdmin = false,
  accountSlot,
}: {
  salon: Salon;
  /** Has an active salon_membership at this salon (any role). */
  isStaff?: boolean;
  isPlatformAdmin?: boolean;
  /** Rendered where the plain "Mi cuenta" link used to sit — pass
   *  `<AccountMenu salon={salon} />` for the real profile dropdown. */
  accountSlot?: ReactNode;
}) {
  const socialLinks = getSocialLinks(salon);
  const [contactOpen, setContactOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const contactTriggerRef = useRef<HTMLButtonElement>(null);
  const firstSocialLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!contactOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setContactOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setContactOpen(false);
        contactTriggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    // Moves focus into the panel on open — a no-op when there are no social
    // links and the panel holds only non-interactive phone/email text.
    firstSocialLinkRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [contactOpen]);

  const hasContactInfo = socialLinks.length > 0 || salon.contact_phone || salon.contact_email;

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
        <BookingTrigger className={buttonVariants({ size: "sm", className: "px-4" })}>
          Reservar una cita
        </BookingTrigger>
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
          Portafolio
        </Link>
        {accountSlot ?? (
          <Link
            href={`/salon/${salon.slug}/account`}
            className="text-muted-foreground hover:text-foreground"
          >
            Mi cuenta
          </Link>
        )}
        {isStaff && (
          <Link
            href={`/salon/${salon.slug}/admin`}
            className="text-gold hover:text-foreground"
          >
            Panel del salón
          </Link>
        )}
        {isPlatformAdmin && (
          <Link href="/platform-admin" className="text-gold hover:text-foreground">
            Plataforma
          </Link>
        )}
        <ShareButton salon={salon} />
        <SwitchButton size="sm" showLabel={false} aria-label="Cambiar tema" className="h-8 w-8 px-0" />
        {hasContactInfo && (
          <div ref={panelRef} className="relative">
            <button
              ref={contactTriggerRef}
              type="button"
              onClick={() => setContactOpen((v) => !v)}
              aria-expanded={contactOpen}
              className="text-muted-foreground hover:text-foreground"
            >
              Contáctanos
            </button>
            <div
              inert={!contactOpen}
              className={cn(
                "absolute top-full right-0 mt-3 w-56 rounded-md border border-border bg-background p-4 shadow-lg transition-[opacity,transform]",
                contactOpen
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
              )}
            >
              {socialLinks.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {socialLinks.map(([key, url], i) => (
                    <li key={key}>
                      <a
                        ref={i === 0 ? firstSocialLinkRef : undefined}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:text-gold"
                      >
                        {SOCIAL_LABELS[key] ?? key}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {(salon.contact_phone || salon.contact_email) && (
                <div
                  className={cn(
                    "flex flex-col gap-1 text-muted-foreground",
                    socialLinks.length > 0 && "mt-3 border-t border-border pt-3"
                  )}
                >
                  {salon.contact_phone && <span>{salon.contact_phone}</span>}
                  {salon.contact_email && <span>{salon.contact_email}</span>}
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
