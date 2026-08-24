import { DateTime } from "luxon";
import Link from "next/link";
import { type Appt, STATUS_DOT_CLASS, calendarHref } from "./calendar-shared";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function MonthGrid({
  zone,
  monthDateISO,
  appointments,
  restrictToOwn,
  membershipId,
}: {
  zone: string;
  monthDateISO: string;
  appointments: Appt[];
  restrictToOwn: boolean;
  membershipId: string | null;
}) {
  const today = DateTime.now().setZone(zone).toISODate();
  const anchor = DateTime.fromISO(monthDateISO, { zone });
  const currentMonth = anchor.month;
  const gridStart = anchor.startOf("month").startOf("week");
  const gridEnd = anchor.endOf("month").endOf("week");
  const dayCount = Math.round(gridEnd.diff(gridStart, "days").days) + 1;

  const byDay = new Map<string, Appt[]>();
  for (const a of appointments) {
    if (restrictToOwn && a.status !== "open" && a.salon_membership_id !== membershipId) continue;
    const key = DateTime.fromISO(a.starts_at).setZone(zone).toISODate()!;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(a);
  }

  const days = Array.from({ length: dayCount }, (_, i) => gridStart.plus({ days: i }));

  function statusCounts(items: Appt[]) {
    const counts = new Map<string, number>();
    for (const a of items) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
    return Array.from(counts.entries());
  }

  return (
    <div className="rounded-md border border-border">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="border-r border-border px-2 py-2 font-sans text-xs font-medium text-muted-foreground last:border-r-0">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const dateISO = date.toISODate()!;
          const items = byDay.get(dateISO) ?? [];
          const inMonth = date.month === currentMonth;
          return (
            <Link
              key={dateISO}
              href={calendarHref("day", dateISO)}
              className={`flex min-h-24 flex-col gap-1.5 border-r border-b border-border p-2 last:border-r-0 hover:bg-muted/40 ${
                inMonth ? "" : "opacity-40"
              }`}
            >
              <span className={`font-sans text-xs ${dateISO === today ? "font-semibold text-gold" : "text-foreground"}`}>{date.day}</span>
              {items.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {statusCounts(items).map(([status, count]) => (
                    <span
                      key={status}
                      className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 font-sans text-[10px] ${
                        status === "open" ? "border border-dashed border-muted-foreground/50 text-muted-foreground" : "bg-muted"
                      }`}
                    >
                      <span className={`size-1.5 rounded-full ${STATUS_DOT_CLASS[status] ?? "bg-muted-foreground"}`} />
                      {count}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
