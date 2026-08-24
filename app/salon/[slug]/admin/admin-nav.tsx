"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ExternalLink, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

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
  const router = useRouter();
  const base = `/salon/${slug}/admin`;
  const [hasUnread, setHasUnread] = useState(unread > 0);
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  // Global shortcut, same convention as Linear/Vercel's command bars — cmdk
  // itself only handles keys while its own input is focused, so opening the
  // palette from anywhere needs a page-level listener.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function isItemActive(href: string) {
    const full = `${base}${href}`;
    return href === "" ? pathname === base : pathname.startsWith(full);
  }

  return (
    <nav className="flex items-center gap-3 border-b border-border px-8 py-4 font-sans text-sm">
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex h-8 w-56 items-center gap-2 rounded-lg border border-border px-2.5 text-muted-foreground hover:text-foreground"
      >
        <SearchIcon className="size-3.5 shrink-0" />
        <span className="flex-1 text-left">Ir a…</span>
        <kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <Command>
          <CommandInput placeholder="Buscar página…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            {NAV_GROUPS.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.label}
                    value={item.label}
                    className={cn(isItemActive(item.href) && "font-medium text-foreground")}
                    onSelect={() => {
                      setPaletteOpen(false);
                      router.push(`${base}${item.href}`);
                    }}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>

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
