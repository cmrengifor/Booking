"use client";

import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { calendarHref } from "./calendar-shared";

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  DateTime.fromObject({ month: i + 1, day: 1 }).setLocale("es").toFormat("LLLL")
);

const YEAR_SPAN = 5;

export function MonthPicker({
  dateISO,
  zone,
  stylistFilter,
}: {
  dateISO: string;
  zone: string;
  stylistFilter: string | null;
}) {
  const router = useRouter();
  const current = DateTime.fromISO(dateISO, { zone });
  const years = Array.from({ length: YEAR_SPAN * 2 + 1 }, (_, i) => current.year - YEAR_SPAN + i);

  function navigate(month: number, year: number) {
    const next = DateTime.fromObject({ year, month, day: 1 }, { zone }).toISODate()!;
    router.push(calendarHref("month", next, stylistFilter));
  }

  const selectClass =
    "rounded-md border border-transparent bg-transparent px-1 py-0.5 font-medium text-foreground capitalize outline-none hover:border-border focus:border-ring";

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label="Mes"
        value={current.month}
        onChange={(e) => navigate(Number(e.target.value), current.year)}
        className={selectClass}
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={i + 1} className="capitalize">
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Año"
        value={current.year}
        onChange={(e) => navigate(current.month, Number(e.target.value))}
        className={selectClass}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
