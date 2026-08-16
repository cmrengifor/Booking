import { DateTime } from "luxon";

export type RangeMode = "day" | "week" | "month" | "quarter" | "semester";

export const RANGE_LABELS: Record<RangeMode, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  quarter: "Trimestre",
  semester: "Semestre",
};

export function isRangeMode(value: string | undefined): value is RangeMode {
  return !!value && value in RANGE_LABELS;
}

export function getRange(mode: RangeMode, refDateIso: string, timezone: string) {
  const ref = DateTime.fromISO(refDateIso, { zone: timezone });
  const anchor = ref.isValid ? ref : DateTime.now().setZone(timezone);

  switch (mode) {
    case "day":
      return { start: anchor.startOf("day"), end: anchor.endOf("day") };
    case "week":
      return { start: anchor.startOf("week"), end: anchor.endOf("week") };
    case "month":
      return { start: anchor.startOf("month"), end: anchor.endOf("month") };
    case "quarter":
      return { start: anchor.startOf("quarter"), end: anchor.endOf("quarter") };
    case "semester": {
      const firstMonthOfHalf = anchor.month <= 6 ? 1 : 7;
      const start = anchor.set({ month: firstMonthOfHalf, day: 1 }).startOf("day");
      return { start, end: start.plus({ months: 6 }).minus({ milliseconds: 1 }) };
    }
  }
}
