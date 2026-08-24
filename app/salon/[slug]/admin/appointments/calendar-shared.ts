import { DateTime } from "luxon";

export type Appt = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  salon_membership_id: string | null;
  customers: { profiles: { full_name: string | null } | null } | null;
  services: { name: string } | null;
  service_variants: { name: string } | null;
};

export type Stylist = { id: string; artist_profiles: { display_name: string } | null };

export type OpenAppt = {
  id: string;
  starts_at: string;
  ends_at: string;
  services: { name: string } | null;
  service_variants: { name: string } | null;
};

export type CalendarMode = "day" | "week" | "month";

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

export const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700",
  confirmed: "bg-sky-500/15 text-sky-700",
  completed: "bg-emerald-500/15 text-emerald-700 opacity-80",
  cancelled: "bg-red-500/10 text-red-700 opacity-70 line-through",
  no_show: "bg-red-500/10 text-red-700 opacity-70",
};

export const STATUS_DOT_CLASS: Record<string, string> = {
  pending: "bg-amber-600",
  confirmed: "bg-sky-600",
  completed: "bg-emerald-600",
  cancelled: "bg-red-600",
  no_show: "bg-red-600",
};

export function minutesInZone(iso: string, zone: string) {
  const dt = DateTime.fromISO(iso).setZone(zone);
  return dt.hour * 60 + dt.minute;
}

export function timeLabel(iso: string, zone: string) {
  return DateTime.fromISO(iso).setZone(zone).toFormat("H:mm");
}

export function appointmentLine(a: { services: { name: string } | null; service_variants: { name: string } | null }, who: string | null) {
  const service = a.service_variants?.name ? `${a.services?.name} — ${a.service_variants.name}` : a.services?.name;
  return who ? `${who} — ${service}` : service;
}

export function stylistColumns(
  appointments: Appt[],
  stylists: Stylist[],
  restrictToOwn: boolean,
  membershipId: string | null
): { key: string; label: string; items: Appt[] }[] {
  if (restrictToOwn) {
    return [
      {
        key: "own",
        label: "Mis citas",
        items: appointments.filter((a) => a.salon_membership_id === membershipId),
      },
    ];
  }
  return stylists.map((s) => ({
    key: s.id,
    label: s.artist_profiles?.display_name ?? "Sin nombre",
    items: appointments.filter((a) => a.salon_membership_id === s.id),
  }));
}

/** Builds the querystring for a calendar link, keeping mode fixed and only
 *  swapping the date — used by every prev/next/today/cell navigation link
 *  across day, week and month so they all stay in the same view. */
export function calendarHref(mode: CalendarMode, dateISO: string) {
  return `?view=calendar&mode=${mode}&date=${dateISO}`;
}
