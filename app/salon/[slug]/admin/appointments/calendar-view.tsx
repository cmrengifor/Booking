import { DateTime } from "luxon";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Salon } from "@/lib/tenant/resolve-salon";
import { DayGrid } from "./day-grid";
import { WeekAgenda } from "./week-agenda";
import { MonthGrid } from "./month-grid";
import { MonthPicker } from "./month-picker";
import { AssignOpenPanel } from "./assign-open-panel";
import { type Appt, type Stylist, type OpenAppt, type CalendarMode, calendarHref } from "./calendar-shared";

function navDates(mode: CalendarMode, dateISO: string, zone: string) {
  const anchor = DateTime.fromISO(dateISO, { zone });
  if (mode === "day") {
    return { prev: anchor.minus({ days: 1 }).toISODate()!, next: anchor.plus({ days: 1 }).toISODate()! };
  }
  if (mode === "week") {
    const weekStart = anchor.startOf("week");
    return { prev: weekStart.minus({ days: 7 }).toISODate()!, next: weekStart.plus({ days: 7 }).toISODate()! };
  }
  return {
    prev: anchor.startOf("month").minus({ months: 1 }).toISODate()!,
    next: anchor.startOf("month").plus({ months: 1 }).toISODate()!,
  };
}

/** Month mode doesn't use this — it renders MonthPicker's own dropdowns
 *  instead, since "which month" is exactly what that control lets you jump
 *  to directly rather than only read. */
function rangeLabel(mode: "day" | "week", dateISO: string, zone: string) {
  const anchor = DateTime.fromISO(dateISO, { zone }).setLocale("es");
  if (mode === "day") {
    const isToday = dateISO === DateTime.now().setZone(zone).toISODate();
    return `${isToday ? "Hoy · " : ""}${anchor.toFormat("d 'de' LLLL")}`;
  }
  const start = anchor.startOf("week");
  const end = start.plus({ days: 6 });
  return start.month === end.month
    ? `${start.toFormat("d")} – ${end.toFormat("d 'de' LLLL")}`
    : `${start.toFormat("d LLL")} – ${end.toFormat("d LLL")}`;
}

export function CalendarView({
  slug,
  salon,
  mode,
  dateISO,
  appointments,
  stylists,
  openPool,
  restrictToOwn,
  membershipId,
  isStylist,
  showCustomerName,
  canAssign,
  stylistFilter,
}: {
  slug: string;
  salon: Salon;
  mode: CalendarMode;
  dateISO: string;
  appointments: Appt[];
  stylists: Stylist[];
  openPool: OpenAppt[];
  restrictToOwn: boolean;
  membershipId: string | null;
  isStylist: boolean;
  showCustomerName: boolean;
  canAssign: boolean;
  stylistFilter: string | null;
}) {
  const zone = salon.timezone;
  const nav = navDates(mode, dateISO, zone);
  const zoneNow = DateTime.now().setZone(zone);
  const isAtToday =
    mode === "day"
      ? dateISO === zoneNow.toISODate()
      : mode === "week"
        ? DateTime.fromISO(dateISO, { zone }).startOf("week").toISODate() === zoneNow.startOf("week").toISODate()
        : DateTime.fromISO(dateISO, { zone }).startOf("month").toISODate() === zoneNow.startOf("month").toISODate();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 font-sans text-sm">
          <Link href={calendarHref(mode, nav.prev, stylistFilter)} aria-label="Anterior" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" />
          </Link>
          {mode === "month" ? (
            <MonthPicker dateISO={dateISO} zone={zone} stylistFilter={stylistFilter} />
          ) : (
            <span className="font-medium text-foreground capitalize">{rangeLabel(mode, dateISO, zone)}</span>
          )}
          <Link href={calendarHref(mode, nav.next, stylistFilter)} aria-label="Siguiente" className="text-muted-foreground hover:text-foreground">
            <ChevronRight className="size-4" />
          </Link>
          {!isAtToday && (
            <Link href={calendarHref(mode, DateTime.now().setZone(zone).toISODate()!, stylistFilter)} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Volver a hoy
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-md border border-border font-sans text-xs">
            {(["day", "week", "month"] as const).map((m) => (
              <Link
                key={m}
                href={calendarHref(m, dateISO, stylistFilter)}
                className={mode === m ? "bg-primary px-3 py-1.5 text-primary-foreground" : "px-3 py-1.5 text-muted-foreground hover:text-foreground"}
              >
                {m === "day" ? "Día" : m === "week" ? "Semana" : "Mes"}
              </Link>
            ))}
          </div>
          {canAssign && <AssignOpenPanel slug={slug} zone={zone} stylists={stylists} openAppointments={openPool} />}
        </div>
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

      {mode === "day" && (
        <DayGrid
          slug={slug}
          zone={zone}
          appointments={appointments}
          stylists={stylists}
          restrictToOwn={restrictToOwn}
          membershipId={membershipId}
          isStylist={isStylist}
          showCustomerName={showCustomerName}
          stylistFilter={stylistFilter}
        />
      )}
      {mode === "week" && (
        <WeekAgenda
          slug={slug}
          zone={zone}
          weekStartISO={DateTime.fromISO(dateISO, { zone }).startOf("week").toISODate()!}
          appointments={appointments}
          stylists={stylists}
          restrictToOwn={restrictToOwn}
          membershipId={membershipId}
          isStylist={isStylist}
          showCustomerName={showCustomerName}
          stylistFilter={stylistFilter}
        />
      )}
      {mode === "month" && (
        <MonthGrid
          zone={zone}
          monthDateISO={dateISO}
          appointments={appointments}
          restrictToOwn={restrictToOwn}
          membershipId={membershipId}
          stylistFilter={stylistFilter}
        />
      )}
    </div>
  );
}
