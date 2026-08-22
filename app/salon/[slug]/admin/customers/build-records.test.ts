import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { buildCustomerRecords, type RawAppointment, type RawCustomer } from "./build-records";

const TZ = "America/Bogota";
const NOW = DateTime.fromISO("2026-08-21T12:00:00", { zone: TZ });

function customer(id: string, profileId: string | null, fullName: string, phone: string | null): RawCustomer {
  return { id, profile_id: profileId, profiles: { full_name: fullName, phone } };
}

function appointment(customerId: string, daysFromNow: number, status: string): RawAppointment {
  return {
    id: `appt-${customerId}-${daysFromNow}`,
    customer_id: customerId,
    starts_at: NOW.plus({ days: daysFromNow }).toUTC().toISO()!,
    status,
    services: { name: "Manicure" },
    salon_memberships: { artist_profiles: { display_name: "Sofia" } },
  };
}

describe("buildCustomerRecords — visibility restriction", () => {
  const customers = [
    customer("cust-a", "profile-a", "Ana", "111"),
    customer("cust-b", "profile-b", "Beta", "222"),
  ];
  const appointments = [appointment("cust-a", 3, "confirmed")]; // only customer A has one

  it("an unrestricted viewer (owner/manager/receptionist) sees every customer", () => {
    const result = buildCustomerRecords({
      customers,
      appointments,
      restrictToOwn: false,
      canSeeContact: true,
      emailByProfileId: new Map(),
      timezone: TZ,
      now: NOW,
    });
    expect(result.customers.map((c) => c.id)).toEqual(["cust-a", "cust-b"]);
  });

  it("a restricted viewer (stylist) only sees customers tied to the scoped appointment set", () => {
    const result = buildCustomerRecords({
      customers,
      appointments,
      restrictToOwn: true,
      canSeeContact: false,
      emailByProfileId: new Map(),
      timezone: TZ,
      now: NOW,
    });
    expect(result.customers.map((c) => c.id)).toEqual(["cust-a"]);
  });
});

describe("buildCustomerRecords — contact info redaction", () => {
  const customers = [customer("cust-a", "profile-a", "Ana", "555-1111")];
  const appointments: RawAppointment[] = [];

  it("includes phone/email when canSeeContact is true", () => {
    const result = buildCustomerRecords({
      customers,
      appointments,
      restrictToOwn: false,
      canSeeContact: true,
      emailByProfileId: new Map([["profile-a", "ana@example.com"]]),
      timezone: TZ,
      now: NOW,
    });
    expect(result.customers[0].phone).toBe("555-1111");
    expect(result.customers[0].email).toBe("ana@example.com");
    expect(result.canSeeContact).toBe(true);
  });

  it("nulls out phone/email when canSeeContact is false, even if the underlying data has values", () => {
    const result = buildCustomerRecords({
      customers,
      appointments,
      restrictToOwn: false,
      canSeeContact: false,
      emailByProfileId: new Map([["profile-a", "ana@example.com"]]),
      timezone: TZ,
      now: NOW,
    });
    expect(result.customers[0].phone).toBeNull();
    expect(result.customers[0].email).toBeNull();
    expect(result.canSeeContact).toBe(false);
  });
});

describe("buildCustomerRecords — bucket classification", () => {
  const base = {
    restrictToOwn: false,
    canSeeContact: false,
    emailByProfileId: new Map<string, string | null>(),
    timezone: TZ,
    now: NOW,
  };

  it("this_week: next appointment within 7 days", () => {
    const result = buildCustomerRecords({
      ...base,
      customers: [customer("c1", null, "A", null)],
      appointments: [appointment("c1", 3, "confirmed")],
    });
    expect(result.customers[0].bucket).toBe("this_week");
  });

  it("upcoming: next appointment beyond 7 days", () => {
    const result = buildCustomerRecords({
      ...base,
      customers: [customer("c1", null, "A", null)],
      appointments: [appointment("c1", 20, "pending")],
    });
    expect(result.customers[0].bucket).toBe("upcoming");
  });

  it("recent: most recent completed appointment within 30 days", () => {
    const result = buildCustomerRecords({
      ...base,
      customers: [customer("c1", null, "A", null)],
      appointments: [appointment("c1", -10, "completed")],
    });
    expect(result.customers[0].bucket).toBe("recent");
    expect(result.customers[0].daysSinceLast).toBe(10);
  });

  it("inactive: most recent completed appointment beyond 30 days", () => {
    const result = buildCustomerRecords({
      ...base,
      customers: [customer("c1", null, "A", null)],
      appointments: [appointment("c1", -60, "completed")],
    });
    expect(result.customers[0].bucket).toBe("inactive");
    expect(result.customers[0].daysSinceLast).toBe(60);
  });

  it("inactive with no daysSinceLast when there are no appointments at all", () => {
    const result = buildCustomerRecords({
      ...base,
      customers: [customer("c1", null, "A", null)],
      appointments: [],
    });
    expect(result.customers[0].bucket).toBe("inactive");
    expect(result.customers[0].daysSinceLast).toBeNull();
  });

  it("prefers a near-future appointment (this_week) over an older completed one", () => {
    const result = buildCustomerRecords({
      ...base,
      customers: [customer("c1", null, "A", null)],
      appointments: [appointment("c1", -60, "completed"), appointment("c1", 2, "confirmed")],
    });
    expect(result.customers[0].bucket).toBe("this_week");
  });
});

describe("buildCustomerRecords — monthly activity", () => {
  it("counts only completed appointments within the 12-month window", () => {
    const result = buildCustomerRecords({
      restrictToOwn: false,
      canSeeContact: false,
      emailByProfileId: new Map(),
      timezone: TZ,
      now: NOW,
      customers: [customer("c1", null, "A", null)],
      appointments: [
        appointment("c1", -10, "completed"),
        appointment("c1", -40, "completed"),
        appointment("c1", -400, "completed"), // outside the 12-month window
      ],
    });
    expect(result.customers[0].distinctActiveMonths).toBe(2);
    expect(result.customers[0].monthlyActivity.length).toBe(2);
  });
});
