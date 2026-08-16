"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

const NAV = [
  { href: "", label: "Overview" },
  { href: "/appointments", label: "Citas" },
  { href: "/customers", label: "Clientes" },
  { href: "/services", label: "Servicios" },
  { href: "/staff", label: "Staff" },
  { href: "/reviews", label: "Reseñas" },
  { href: "/analytics", label: "Análisis" },
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

  return (
    <nav className="flex items-center gap-4 border-b border-border px-8 py-4 font-sans text-sm">
      {NAV.map((item) => {
        const href = `${base}${item.href}`;
        const isActive = item.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={item.label}
            href={href}
            className={
              isActive
                ? "border-b-2 border-gold pb-1 font-medium text-foreground"
                : "pb-1 text-muted-foreground hover:text-foreground"
            }
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href={`/salon/${slug}/notifications`}
        aria-label="Notificaciones"
        className="relative ml-auto text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-5" />
        {hasUnread && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-red-500" />}
      </Link>
    </nav>
  );
}
