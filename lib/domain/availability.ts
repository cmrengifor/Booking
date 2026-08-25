import { DateTime, Interval } from "luxon";

/**
 * Availability engine. Pure functions, no DB access — callers (Server
 * Actions in Phase 5) fetch the rows and pass them in. This is deliberate:
 * it's what makes the algorithm testable against seeded fixtures before any
 * booking UI exists, per the Phase 4 roadmap entry.
 *
 * Timezone handling follows docs/ARCHITECTURE.md section F: every wall-clock
 * time (weekly hours, breaks) is meaningless without the salon's own IANA
 * timezone, and must never be combined with a date using anything else
 * (browser zone, server/session default). Luxon's `fromISO(..., { zone })`
 * is the one place that conversion happens.
 */

// Deliberately separate types: salon_weekly_hours uses open_time/close_time,
// staff_weekly_hours uses start_time/end_time (+ optional break) — mirroring
// the actual column names avoids exactly the mismatch this engine used to
// have (open/close silently confused with start/end during development).

export type SalonHoursRow = {
  day_of_week: number; // 0 = Sunday .. 6 = Saturday, matches the DB convention
  open_time: string; // "HH:MM" or "HH:MM:SS", salon-local wall clock
  close_time: string;
};

export type ArtistHoursRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
};

export type TimeOffRow = {
  start_date: string; // "YYYY-MM-DD"
  end_date: string;
};

export type BusyInterval = {
  starts_at: string; // ISO instant (timestamptz)
  ends_at: string;
};

export type EffectiveSlot = {
  durationMinutes: number;
  bufferMinutes: number;
};

export function resolveEffectiveSlot(
  service: { base_duration_minutes: number | null; buffer_minutes: number },
  variant: { duration_minutes: number; buffer_minutes: number } | null
): EffectiveSlot {
  if (variant) {
    return {
      durationMinutes: variant.duration_minutes,
      bufferMinutes: variant.buffer_minutes,
    };
  }
  if (service.base_duration_minutes == null) {
    throw new Error(
      "Service has no variant and no base_duration_minutes — invalid state."
    );
  }
  return {
    durationMinutes: service.base_duration_minutes,
    bufferMinutes: service.buffer_minutes,
  };
}

/** DB day-of-week convention (0=Sun..6=Sat) for a date within a given zone. */
export function dayOfWeekInZone(date: string, timezone: string): number {
  const dt = DateTime.fromISO(date, { zone: timezone });
  return dt.weekday % 7; // Luxon: 1=Mon..7=Sun -> 0=Sun..6=Sat
}

function timeOnDate(date: string, time: string, timezone: string): DateTime {
  const hhmm = time.length >= 5 ? time.slice(0, 5) : time;
  return DateTime.fromISO(`${date}T${hhmm}`, { zone: timezone });
}

/**
 * Free time ranges for one artist on one calendar date, before slicing into
 * discrete bookable start times. Empty array means "not bookable that day"
 * (day off, salon closed, on time off, or fully booked).
 */
export function freeIntervalsForArtistOnDate(params: {
  date: string;
  timezone: string;
  salonHours: SalonHoursRow[];
  artistHours: ArtistHoursRow[];
  timeOff: TimeOffRow[];
  busy: BusyInterval[];
}): Interval[] {
  const { date, timezone, salonHours, artistHours, timeOff, busy } = params;
  const dow = dayOfWeekInZone(date, timezone);

  const salonRow = salonHours.find((h) => h.day_of_week === dow);
  const artistRow = artistHours.find((h) => h.day_of_week === dow);
  if (!salonRow || !artistRow) return [];

  const onTimeOff = timeOff.some(
    (t) => date >= t.start_date && date <= t.end_date
  );
  if (onTimeOff) return [];

  const salonInterval = Interval.fromDateTimes(
    timeOnDate(date, salonRow.open_time, timezone),
    timeOnDate(date, salonRow.close_time, timezone)
  );
  const artistInterval = Interval.fromDateTimes(
    timeOnDate(date, artistRow.start_time, timezone),
    timeOnDate(date, artistRow.end_time, timezone)
  );

  const outer = salonInterval.intersection(artistInterval);
  if (!outer || !outer.isValid) return [];

  let free: Interval[] = [outer];

  if (artistRow.break_start && artistRow.break_end) {
    const breakInterval = Interval.fromDateTimes(
      timeOnDate(date, artistRow.break_start, timezone),
      timeOnDate(date, artistRow.break_end, timezone)
    );
    free = free.flatMap((i) => i.difference(breakInterval));
  }

  for (const b of busy) {
    const busyInterval = Interval.fromDateTimes(
      DateTime.fromISO(b.starts_at),
      DateTime.fromISO(b.ends_at)
    );
    free = free.flatMap((i) => i.difference(busyInterval));
  }

  return free.filter((i) => i.isValid && i.length("minutes") > 0);
}

/** Candidate slot start instants (ISO strings) within a set of free ranges. */
export function slotStartsFromFreeIntervals(
  freeIntervals: Interval[],
  slotMinutes: number,
  granularityMinutes: number
): string[] {
  const starts: string[] = [];

  for (const interval of freeIntervals) {
    let cursor = interval.start!;
    while (cursor.plus({ minutes: slotMinutes }) <= interval.end!) {
      starts.push(cursor.toUTC().toISO()!);
      cursor = cursor.plus({ minutes: granularityMinutes });
    }
  }

  return starts;
}

/**
 * Every candidate slot start within the salon's own opening hours for the
 * day — ignoring artist hours, breaks, time off, and existing bookings
 * entirely. This is deliberately the salon-only interval, not any artist's
 * free time: it's the fixed grid the UI renders (so "9:00, 9:15, 9:30…"
 * stays in the same place whichever artist is picked), against which
 * `computeArtistSlots`/`computeAnyArtistSlots` results are then checked
 * per slot to mark it available or not.
 */
export function computeSalonSlots(params: {
  date: string;
  timezone: string;
  salonHours: SalonHoursRow[];
  slot: EffectiveSlot;
  granularityMinutes?: number;
}): string[] {
  const { date, timezone, salonHours, slot, granularityMinutes } = params;
  const dow = dayOfWeekInZone(date, timezone);
  const salonRow = salonHours.find((h) => h.day_of_week === dow);
  if (!salonRow) return [];

  const salonInterval = Interval.fromDateTimes(
    timeOnDate(date, salonRow.open_time, timezone),
    timeOnDate(date, salonRow.close_time, timezone)
  );
  if (!salonInterval.isValid) return [];

  return slotStartsFromFreeIntervals(
    [salonInterval],
    slot.durationMinutes + slot.bufferMinutes,
    granularityMinutes ?? 15
  );
}

export function computeArtistSlots(params: {
  date: string;
  timezone: string;
  salonHours: SalonHoursRow[];
  artistHours: ArtistHoursRow[];
  timeOff: TimeOffRow[];
  busy: BusyInterval[];
  slot: EffectiveSlot;
  granularityMinutes?: number;
}): string[] {
  const free = freeIntervalsForArtistOnDate(params);
  return slotStartsFromFreeIntervals(
    free,
    params.slot.durationMinutes + params.slot.bufferMinutes,
    params.granularityMinutes ?? 15
  );
}

/**
 * Any-artist mode: union of every candidate's slots, deduplicated. Per
 * docs/ARCHITECTURE.md section E, this is offered without ever picking a
 * specific artist — the appointment is created OPEN, not auto-assigned.
 */
export function computeAnyArtistSlots(
  candidates: Array<{
    artistHours: ArtistHoursRow[];
    timeOff: TimeOffRow[];
    busy: BusyInterval[];
  }>,
  shared: {
    date: string;
    timezone: string;
    salonHours: SalonHoursRow[];
    slot: EffectiveSlot;
    granularityMinutes?: number;
  }
): string[] {
  const all = new Set<string>();
  for (const candidate of candidates) {
    const slots = computeArtistSlots({ ...shared, ...candidate });
    slots.forEach((s) => all.add(s));
  }
  return Array.from(all).sort();
}
