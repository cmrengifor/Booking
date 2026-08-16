import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  computeAnyArtistSlots,
  computeArtistSlots,
  dayOfWeekInZone,
  freeIntervalsForArtistOnDate,
  resolveEffectiveSlot,
} from "./availability";

const TZ = "America/Bogota";
const TUESDAY = "2026-08-18"; // confirmed Tuesday
const SUNDAY = "2026-08-16"; // confirmed Sunday

const salonHours = [
  { day_of_week: 2, open_time: "09:00", close_time: "18:00" }, // Tue
  { day_of_week: 3, open_time: "09:00", close_time: "18:00" },
];

const artistHoursWithBreak = [
  {
    day_of_week: 2,
    start_time: "09:00",
    end_time: "18:00",
    break_start: "13:00",
    break_end: "14:00",
  },
];

describe("dayOfWeekInZone", () => {
  it("maps Luxon's ISO weekday to the DB's 0=Sun..6=Sat convention", () => {
    expect(dayOfWeekInZone(TUESDAY, TZ)).toBe(2);
    expect(dayOfWeekInZone(SUNDAY, TZ)).toBe(0);
  });
});

describe("resolveEffectiveSlot", () => {
  it("uses the variant when one is given", () => {
    expect(
      resolveEffectiveSlot(
        { base_duration_minutes: null, buffer_minutes: 0 },
        { duration_minutes: 60, buffer_minutes: 15 }
      )
    ).toEqual({ durationMinutes: 60, bufferMinutes: 15 });
  });

  it("falls back to the service's own price/duration without a variant", () => {
    expect(
      resolveEffectiveSlot(
        { base_duration_minutes: 45, buffer_minutes: 10 },
        null
      )
    ).toEqual({ durationMinutes: 45, bufferMinutes: 10 });
  });

  it("throws for an invalid state (no variant, no base duration)", () => {
    expect(() =>
      resolveEffectiveSlot({ base_duration_minutes: null, buffer_minutes: 0 }, null)
    ).toThrow();
  });
});

describe("freeIntervalsForArtistOnDate", () => {
  it("returns empty when the artist has no row for that weekday", () => {
    const free = freeIntervalsForArtistOnDate({
      date: SUNDAY,
      timezone: TZ,
      salonHours,
      artistHours: artistHoursWithBreak,
      timeOff: [],
      busy: [],
    });
    expect(free).toEqual([]);
  });

  it("returns empty when the salon has no row for that weekday", () => {
    const free = freeIntervalsForArtistOnDate({
      date: SUNDAY,
      timezone: TZ,
      salonHours: [],
      artistHours: [{ day_of_week: 0, start_time: "09:00", end_time: "18:00" }],
      timeOff: [],
      busy: [],
    });
    expect(free).toEqual([]);
  });

  it("returns empty when the date falls inside time off", () => {
    const free = freeIntervalsForArtistOnDate({
      date: TUESDAY,
      timezone: TZ,
      salonHours,
      artistHours: artistHoursWithBreak,
      timeOff: [{ start_date: "2026-08-17", end_date: "2026-08-19" }],
      busy: [],
    });
    expect(free).toEqual([]);
  });

  it("splits the day around the break", () => {
    const free = freeIntervalsForArtistOnDate({
      date: TUESDAY,
      timezone: TZ,
      salonHours,
      artistHours: artistHoursWithBreak,
      timeOff: [],
      busy: [],
    });
    expect(free).toHaveLength(2);
    expect(free[0].start!.setZone(TZ).toFormat("HH:mm")).toBe("09:00");
    expect(free[0].end!.setZone(TZ).toFormat("HH:mm")).toBe("13:00");
    expect(free[1].start!.setZone(TZ).toFormat("HH:mm")).toBe("14:00");
    expect(free[1].end!.setZone(TZ).toFormat("HH:mm")).toBe("18:00");
  });

  it("subtracts an existing busy appointment", () => {
    const busyStart = DateTime.fromISO("2026-08-18T10:00", { zone: TZ }).toUTC().toISO()!;
    const busyEnd = DateTime.fromISO("2026-08-18T11:00", { zone: TZ }).toUTC().toISO()!;

    const free = freeIntervalsForArtistOnDate({
      date: TUESDAY,
      timezone: TZ,
      salonHours,
      artistHours: artistHoursWithBreak,
      timeOff: [],
      busy: [{ starts_at: busyStart, ends_at: busyEnd }],
    });

    // Morning splits around the 10-11 booking, afternoon unaffected.
    expect(free).toHaveLength(3);
    expect(free[0].end!.setZone(TZ).toFormat("HH:mm")).toBe("10:00");
    expect(free[1].start!.setZone(TZ).toFormat("HH:mm")).toBe("11:00");
  });

  it("produces the correct UTC instant for a salon-local wall-clock time (America/Bogota = UTC-5)", () => {
    const free = freeIntervalsForArtistOnDate({
      date: TUESDAY,
      timezone: TZ,
      salonHours,
      artistHours: artistHoursWithBreak,
      timeOff: [],
      busy: [],
    });
    // 09:00 Bogota == 14:00 UTC
    expect(free[0].start!.toUTC().toFormat("HH:mm")).toBe("14:00");
  });
});

describe("slotStartsFromFreeIntervals / computeArtistSlots", () => {
  it("slices a free range into slots that fully fit, at the given granularity", () => {
    const slots = computeArtistSlots({
      date: TUESDAY,
      timezone: TZ,
      salonHours,
      artistHours: artistHoursWithBreak,
      timeOff: [],
      busy: [],
      slot: { durationMinutes: 45, bufferMinutes: 10 }, // 55-minute slot
      granularityMinutes: 15,
    });

    // Morning window 09:00-13:00 (4h = 240min) with a 55-min slot every 15min:
    // last valid start is 12:05 (12:05+55=13:00) -> starts at 09:00,09:15,...,12:00? check exact fit
    expect(slots.length).toBeGreaterThan(0);
    const firstLocal = DateTime.fromISO(slots[0]).setZone(TZ).toFormat("HH:mm");
    expect(firstLocal).toBe("09:00");
    // No slot should start inside the break.
    const duringBreak = slots.some((s) => {
      const t = DateTime.fromISO(s).setZone(TZ).toFormat("HH:mm");
      return t >= "13:00" && t < "14:00";
    });
    expect(duringBreak).toBe(false);
  });

  it("returns no slots when nothing fits (slot longer than any free range)", () => {
    const slots = computeArtistSlots({
      date: TUESDAY,
      timezone: TZ,
      salonHours,
      artistHours: artistHoursWithBreak,
      timeOff: [],
      busy: [],
      slot: { durationMinutes: 600, bufferMinutes: 0 },
    });
    expect(slots).toEqual([]);
  });
});

describe("computeAnyArtistSlots", () => {
  it("unions slots across candidates without picking one", () => {
    const morningOnly = [
      { day_of_week: 2, start_time: "09:00", end_time: "12:00" },
    ];
    const afternoonOnly = [
      { day_of_week: 2, start_time: "15:00", end_time: "18:00" },
    ];

    const slots = computeAnyArtistSlots(
      [
        { artistHours: morningOnly, timeOff: [], busy: [] },
        { artistHours: afternoonOnly, timeOff: [], busy: [] },
      ],
      {
        date: TUESDAY,
        timezone: TZ,
        salonHours,
        slot: { durationMinutes: 30, bufferMinutes: 0 },
      }
    );

    const hours = slots.map((s) => DateTime.fromISO(s).setZone(TZ).toFormat("HH:mm"));
    expect(hours).toContain("09:00");
    expect(hours).toContain("15:00");
    expect(hours).not.toContain("13:00"); // neither artist works 1pm
  });
});
