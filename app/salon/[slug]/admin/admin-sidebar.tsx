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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

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

export function AdminSidebar({
  slug,
  salonName,
  unread,
  userId,
}: {
  slug: string;
  salonName: string;
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
    <>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="gap-3 px-3 py-3">
          <Link href={base} className="px-1 font-heading text-lg text-sidebar-foreground italic">
            {salonName}
          </Link>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 items-center gap-2 rounded-lg border border-sidebar-border px-2.5 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            <SearchIcon className="size-3.5 shrink-0" />
            <span className="flex-1 text-left">Ir a…</span>
            <kbd className="rounded border border-sidebar-border bg-sidebar-accent px-1 py-px font-mono text-[10px] text-sidebar-foreground/70">
              ⌘K
            </kbd>
          </button>
        </SidebarHeader>

        <SidebarContent>
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        isActive={isItemActive(item.href)}
                        render={<Link href={`${base}${item.href}`} />}
                      >
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="gap-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href={`/salon/${slug}`} />}>
                <ExternalLink />
                Ver sitio
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href={`/salon/${slug}/notifications`} />}>
                <Bell />
                Notificaciones
                {hasUnread && <span className="ml-auto size-2 shrink-0 rounded-full bg-red-500" />}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Rendered as a sibling, not inside <Sidebar> — on mobile, Sidebar's
          children get relocated into its own Sheet (itself a @base-ui/react
          Dialog), and nesting CommandDialog's Dialog inside that one crashed
          cmdk's internal store ("Cannot read properties of undefined
          (reading 'subscribe')") the moment the Sheet opened. Keeping this
          outside Sidebar entirely sidesteps nested-Dialog-in-Dialog. */}
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
    </>
  );
}
