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

export type Stylist = {
  id: string;
  artist_profiles: { display_name: string; headshot_url: string | null } | null;
};

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

/** `stylistFilter` narrows which stylist columns render at all (the
 *  underlying `appointments` are already scoped server-side by the same
 *  filter — this just keeps Day view from drawing empty columns for
 *  everyone else once a single stylist is picked). */
export function stylistColumns(
  appointments: Appt[],
  stylists: Stylist[],
  restrictToOwn: boolean,
  membershipId: string | null,
  stylistFilter: string | null
): { key: string; label: string; avatarUrl: string | null; items: Appt[] }[] {
  if (restrictToOwn) {
    return [
      {
        key: "own",
        label: "Mis citas",
        avatarUrl: null,
        items: appointments.filter((a) => a.salon_membership_id === membershipId),
      },
    ];
  }
  const visible = stylistFilter ? stylists.filter((s) => s.id === stylistFilter) : stylists;
  return visible.map((s) => ({
    key: s.id,
    label: s.artist_profiles?.display_name ?? "Sin nombre",
    avatarUrl: s.artist_profiles?.headshot_url ?? null,
    items: appointments.filter((a) => a.salon_membership_id === s.id),
  }));
}

/** Builds the querystring for a calendar link, keeping mode and the active
 *  stylist filter fixed and only swapping the date — used by every
 *  prev/next/today/cell navigation link across day, week and month so none
 *  of them silently drop the current filter. */
export function calendarHref(mode: CalendarMode, dateISO: string, stylistFilter?: string | null) {
  const qp = new URLSearchParams({ view: "calendar", mode, date: dateISO });
  if (stylistFilter) qp.set("stylist", stylistFilter);
  return `?${qp.toString()}`;
}

/** Builds a link to the appointments page itself (Lista or Calendario),
 *  keeping the active stylist filter and, for Calendario, the current
 *  mode/date. Plain data in, plain string out — safe to import from both a
 *  Server Component (the Lista/Calendario toggle) and a Client Component
 *  (the stylist combobox), since a function like this can cross that
 *  boundary as a shared import but never as a prop. */
export function appointmentsHref(
  base: string,
  params: { view: "list" | "calendar"; mode: CalendarMode; dateISO: string; stylist: string | null }
) {
  const qp = new URLSearchParams();
  if (params.view === "calendar") {
    qp.set("view", "calendar");
    qp.set("mode", params.mode);
    qp.set("date", params.dateISO);
  }
  if (params.stylist) qp.set("stylist", params.stylist);
  const qs = qp.toString();
  return qs ? `${base}?${qs}` : base;
}
