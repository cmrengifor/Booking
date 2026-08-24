import { Button } from "@/components/ui/button";
import { takeOpenAppointment } from "./actions";
import { StylistAvatar } from "./stylist-avatar";
import {
  type Appt,
  type Stylist,
  STATUS_LABEL,
  STATUS_CLASS,
  minutesInZone,
  timeLabel,
  appointmentLine,
  stylistColumns,
} from "./calendar-shared";

const PX_PER_MIN = 1;
const MIN_BLOCK_HEIGHT = 22;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;

export function DayGrid({
  slug,
  zone,
  appointments,
  stylists,
  restrictToOwn,
  membershipId,
  isStylist,
  showCustomerName,
}: {
  slug: string;
  zone: string;
  appointments: Appt[];
  stylists: Stylist[];
  restrictToOwn: boolean;
  membershipId: string | null;
  isStylist: boolean;
  showCustomerName: boolean;
}) {
  const open = appointments.filter((a) => a.status === "open");
  const columns = stylistColumns(appointments, stylists, restrictToOwn, membershipId);

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
            {time} · {appointmentLine(a, null)}
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
        <p className="truncate font-sans text-xs text-foreground">
          {appointmentLine(a, showCustomerName ? (a.customers?.profiles?.full_name ?? null) : null)}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <div className="flex min-w-[640px] border-b border-border">
        <div className="w-14 shrink-0 border-r border-border" />
        <div className="flex-1 border-r border-border px-3 py-2 font-sans text-xs font-medium text-foreground">Abiertas</div>
        {columns.map((c) => (
          <div
            key={c.key}
            className="flex flex-1 items-center gap-2 border-r border-border px-3 py-2 font-sans text-xs font-medium text-foreground last:border-r-0"
          >
            <StylistAvatar name={c.label} url={c.avatarUrl} size={22} />
            <span className="truncate">{c.label}</span>
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
            backgroundImage: "repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent 60px)",
          }}
        >
          {open.map(block)}
        </div>

        {columns.map((c) => (
          <div
            key={c.key}
            className="relative flex-1 border-r border-border last:border-r-0"
            style={{
              backgroundImage: "repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent 60px)",
            }}
          >
            {c.items.map(block)}
          </div>
        ))}
      </div>
    </div>
  );
}
