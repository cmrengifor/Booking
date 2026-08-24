import { DateTime } from "luxon";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Salon } from "@/lib/tenant/resolve-salon";
import { takeOpenAppointment } from "./actions";

type Appt = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  salon_membership_id: string | null;
  customers: { profiles: { full_name: string | null } | null } | null;
  services: { name: string } | null;
  service_variants: { name: string } | null;
};

type Stylist = { id: string; artist_profiles: { display_name: string } | null };

const PX_PER_MIN = 1;
const MIN_BLOCK_HEIGHT = 22;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700",
  confirmed: "bg-sky-500/15 text-sky-700",
  completed: "bg-emerald-500/15 text-emerald-700 opacity-80",
  cancelled: "bg-red-500/10 text-red-700 opacity-70 line-through",
  no_show: "bg-red-500/10 text-red-700 opacity-70",
};

function minutesInZone(iso: string, zone: string) {
  const dt = DateTime.fromISO(iso).setZone(zone);
  return dt.hour * 60 + dt.minute;
}

function timeLabel(iso: string, zone: string) {
  return DateTime.fromISO(iso).setZone(zone).toFormat("H:mm");
}

function appointmentLine(a: Appt, showCustomerName: boolean) {
  const service = a.service_variants?.name
    ? `${a.services?.name} — ${a.service_variants.name}`
    : a.services?.name;
  const who = showCustomerName ? a.customers?.profiles?.full_name : null;
  return who ? `${who} — ${service}` : service;
}

export function CalendarView({
  slug,
  salon,
  dateISO,
  appointments,
  stylists,
  restrictToOwn,
  membershipId,
  isStylist,
  showCustomerName,
}: {
  slug: string;
  salon: Salon;
  dateISO: string;
  appointments: Appt[];
  stylists: Stylist[];
  restrictToOwn: boolean;
  membershipId: string | null;
  isStylist: boolean;
  showCustomerName: boolean;
}) {
  const zone = salon.timezone;
  const open = appointments.filter((a) => a.status === "open");

  const columns: { key: string; label: string; items: Appt[] }[] = restrictToOwn
    ? [
        {
          key: "own",
          label: "Mis citas",
          items: appointments.filter((a) => a.salon_membership_id === membershipId),
        },
      ]
    : stylists.map((s) => ({
        key: s.id,
        label: s.artist_profiles?.display_name ?? "Sin nombre",
        items: appointments.filter((a) => a.salon_membership_id === s.id),
      }));

  const bounds = appointments.length
    ? {
        startHour: Math.min(DEFAULT_START_HOUR, Math.floor(Math.min(...appointments.map((a) => minutesInZone(a.starts_at, zone))) / 60)),
        endHour: Math.max(DEFAULT_END_HOUR, Math.ceil(Math.max(...appointments.map((a) => minutesInZone(a.ends_at, zone))) / 60)),
      }
    : { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  const gridStart = bounds.startHour * 60;
  const gridHeight = (bounds.endHour - bounds.startHour) * 60 * PX_PER_MIN;

  const hourMarks = Array.from({ length: bounds.endHour - bounds.startHour }, (_, i) => bounds.startHour + i);

  function block(a: Appt) {
    const top = (minutesInZone(a.starts_at, zone) - gridStart) * PX_PER_MIN;
    const height = Math.max(
      MIN_BLOCK_HEIGHT,
      (minutesInZone(a.ends_at, zone) - minutesInZone(a.starts_at, zone)) * PX_PER_MIN
    );
    const time = `${timeLabel(a.starts_at, zone)}–${timeLabel(a.ends_at, zone)}`;

    if (a.status === "open") {
      return (
        <div
          key={a.id}
          style={{ top, height }}
          className="absolute right-1 left-1 overflow-hidden rounded-md border border-dashed border-muted-foreground/50 px-2 py-1"
        >
          <p className="truncate font-sans text-[11px] text-muted-foreground">
            {time} · {appointmentLine(a, false)}
          </p>
          {isStylist && (
            <form action={takeOpenAppointment.bind(null, a.id, null, slug)} className="mt-1">
              <Button type="submit" size="xs">
                Tomar
              </Button>
            </form>
          )}
        </div>
      );
    }

    return (
      <div
        key={a.id}
        style={{ top, height }}
        className={`absolute right-1 left-1 overflow-hidden rounded-md px-2 py-1 ${STATUS_CLASS[a.status] ?? "bg-muted text-muted-foreground"}`}
      >
        <p className="truncate font-sans text-[11px] font-medium">
          {time} {a.status !== "confirmed" && `· ${STATUS_LABEL[a.status] ?? a.status}`}
        </p>
        <p className="truncate font-sans text-xs text-foreground">{appointmentLine(a, showCustomerName)}</p>
      </div>
    );
  }

  const prevDate = DateTime.fromISO(dateISO, { zone }).minus({ days: 1 }).toISODate();
  const nextDate = DateTime.fromISO(dateISO, { zone }).plus({ days: 1 }).toISODate();
  const isToday = dateISO === DateTime.now().setZone(zone).toISODate();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 font-sans text-sm">
        <Link
          href={`?view=calendar&date=${prevDate}`}
          aria-label="Día anterior"
          className="text-muted-foreground hover:text-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="font-medium text-foreground">
          {isToday ? "Hoy · " : ""}
          {DateTime.fromISO(dateISO, { zone }).setLocale("es").toFormat("d 'de' LLLL")}
        </span>
        <Link
          href={`?view=calendar&date=${nextDate}`}
          aria-label="Día siguiente"
          className="text-muted-foreground hover:text-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
        {!isToday && (
          <Link
            href={`?view=calendar&date=${DateTime.now().setZone(zone).toISODate()}`}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Volver a hoy
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-4 font-sans text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-600" />
          Confirmada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-600" />
          Pendiente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full border border-dashed border-muted-foreground" />
          Abierta
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-600" />
          Completada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-red-600" />
          Cancelada / No asistió
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <div className="flex min-w-[640px] border-b border-border">
          <div className="w-14 shrink-0 border-r border-border" />
          <div className="flex-1 border-r border-border px-3 py-2 font-sans text-xs font-medium text-foreground">
            Abiertas
          </div>
          {columns.map((c) => (
            <div key={c.key} className="flex-1 border-r border-border px-3 py-2 font-sans text-xs font-medium text-foreground last:border-r-0">
              {c.label}
            </div>
          ))}
        </div>

        <div className="flex min-w-[640px]" style={{ height: gridHeight }}>
          <div className="relative w-14 shrink-0 border-r border-border">
            {hourMarks.map((h) => (
              <span
                key={h}
                style={{ top: (h - bounds.startHour) * 60 * PX_PER_MIN - 6 }}
                className="absolute left-2 font-sans text-[11px] text-muted-foreground"
              >
                {h}:00
              </span>
            ))}
          </div>

          <div
            className="relative flex-1 border-r border-border"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent 60px)",
            }}
          >
            {open.map(block)}
          </div>

          {columns.map((c) => (
            <div
              key={c.key}
              className="relative flex-1 border-r border-border last:border-r-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent 60px)",
              }}
            >
              {c.items.map(block)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
