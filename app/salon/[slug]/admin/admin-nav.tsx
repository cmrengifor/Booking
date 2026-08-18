"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Resumen",
    items: [{ href: "", label: "Overview" }],
  },
  {
    label: "Operación",
    items: [
      { href: "/appointments", label: "Citas" },
      { href: "/customers", label: "Clientes" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/services", label: "Servicios" },
      { href: "/staff", label: "Staff" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/reviews", label: "Reseñas" },
      { href: "/analytics", label: "Análisis" },
    ],
  },
];

const TYPE_LABELS: Record<string, string> = {
  booking_requested: "Solicitud enviada",
  booking_confirmed: "Reserva confirmada",
  booking_rejected: "Reserva no confirmada",
  appointment_rescheduled: "Cita reagendada",
  appointment_cancelled: "Cita cancelada",
  appointment_reminder: "Recordatorio",
  review_request: "Deja tu reseña",
  open_appointment_available: "Cita abierta disponible",
  appointment_assigned: "Nueva solicitud",
};

export function AdminNav({
  slug,
  unread,
  userId,
}: {
  slug: string;
  unread: number;
  userId: string;
}) {
  const pathname = usePathname();
  const base = `/salon/${slug}/admin`;
  const [hasUnread, setHasUnread] = useState(unread > 0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`admin-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_profile_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as Tables<"notifications">;
          toast(TYPE_LABELS[notification.type] ?? notification.title, {
            description: notification.body ?? undefined,
          });
          setHasUnread(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  function isItemActive(href: string) {
    const full = `${base}${href}`;
    return href === "" ? pathname === base : pathname.startsWith(full);
  }

  return (
    <nav className="flex items-center gap-3 border-b border-border px-8 py-4 font-sans text-sm">
      <div className="flex h-8 items-center gap-0.5 rounded-lg border border-border p-[3px]">
        {NAV_GROUPS.map((group) => (
          <NavMenu
            key={group.label}
            label={group.label}
            items={group.items}
            base={base}
            active={group.items.some((item) => isItemActive(item.href))}
            isItemActive={isItemActive}
          />
        ))}
      </div>
      <Link
        href={`/salon/${slug}`}
        className="ml-auto flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="size-4" />
        Ver sitio
      </Link>
      <Link
        href={`/salon/${slug}/notifications`}
        aria-label="Notificaciones"
        className="relative text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-5" />
        {hasUnread && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-red-500" />}
      </Link>
    </nav>
  );
}

/**
 * Hand-rolled click-to-open dropdown, not shadcn's Menubar/DropdownMenu —
 * @base-ui/react 1.7.0's Menu family doesn't open on click in this project's
 * React 19.2.8 / Next 16 Turbopack stack (verified against the library's own
 * docs example, in both dev and production builds; onOpenChange never
 * fires). Same pattern site-header.tsx's "Contáctanos" already uses in
 * production. Styled to match Menubar's visual language regardless.
 */
function NavMenu({
  label,
  items,
  base,
  active,
  isItemActive,
}: {
  label: string;
  items: { href: string; label: string }[];
  base: string;
  active: boolean;
  isItemActive: (href: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex items-center rounded-sm px-1.5 py-[2px] text-sm font-medium outline-none select-none hover:bg-muted",
          open && "bg-muted",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 z-50 mt-1.5 min-w-36 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {items.map((item) => (
            <Link
              key={item.label}
              href={`${base}${item.href}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground",
                isItemActive(item.href) ? "font-medium text-foreground" : "text-foreground/90"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
