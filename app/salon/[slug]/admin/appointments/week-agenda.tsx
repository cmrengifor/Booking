import { DateTime } from "luxon";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { takeOpenAppointment } from "./actions";
import {
  type Appt,
  type Stylist,
  STATUS_LABEL,
  STATUS_CLASS,
  timeLabel,
  appointmentLine,
  calendarHref,
} from "./calendar-shared";

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function WeekAgenda({
  slug,
  zone,
  weekStartISO,
  appointments,
  stylists,
  restrictToOwn,
  membershipId,
  isStylist,
  showCustomerName,
}: {
  slug: string;
  zone: string;
  weekStartISO: string;
  appointments: Appt[];
  stylists: Stylist[];
  restrictToOwn: boolean;
  membershipId: string | null;
  isStylist: boolean;
  showCustomerName: boolean;
}) {
  const stylistName = new Map(stylists.map((s) => [s.id, s.artist_profiles?.display_name ?? "Sin nombre"]));
  const today = DateTime.now().setZone(zone).toISODate();
  const weekStart = DateTime.fromISO(weekStartISO, { zone });

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = weekStart.plus({ days: i });
    const dateISO = date.toISODate()!;
    const items = appointments
      .filter((a) => {
        const own = restrictToOwn ? a.salon_membership_id === membershipId || a.status === "open" : true;
        return own && DateTime.fromISO(a.starts_at).setZone(zone).toISODate() === dateISO;
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return { dateISO, label: DAY_LABELS[i], dayNumber: date.day, items };
  });

  function chip(a: Appt) {
    const time = timeLabel(a.starts_at, zone);

    if (a.status === "open") {
      return (
        <div key={a.id} className="rounded-md border border-dashed border-muted-foreground/50 px-2 py-1.5">
          <p className="font-sans text-[11px] text-muted-foreground">
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

    const stylist = a.salon_membership_id ? stylistName.get(a.salon_membership_id) : null;
    return (
      <div key={a.id} className={`rounded-md px-2 py-1.5 ${STATUS_CLASS[a.status] ?? "bg-muted text-muted-foreground"}`}>
        <p className="font-sans text-[11px] font-medium">
          {time} {a.status !== "confirmed" && `· ${STATUS_LABEL[a.status] ?? a.status}`}
        </p>
        <p className="font-sans text-xs text-foreground">
          {appointmentLine(a, showCustomerName ? (a.customers?.profiles?.full_name ?? null) : null)}
        </p>
        {!restrictToOwn && stylist && <p className="mt-0.5 font-sans text-[11px] text-muted-foreground">{stylist}</p>}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
      {days.map((d) => (
        <div key={d.dateISO} className="flex flex-col gap-2 rounded-md border border-border p-3">
          <Link
            href={calendarHref("day", d.dateISO)}
            className={`font-sans text-xs font-medium hover:text-foreground ${
              d.dateISO === today ? "text-gold" : "text-muted-foreground"
            }`}
          >
            {d.label} {d.dayNumber}
          </Link>
          <div className="flex flex-col gap-2">
            {d.items.map(chip)}
            {!d.items.length && <p className="font-sans text-[11px] text-muted-foreground">Sin citas</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
