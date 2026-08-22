import { DateTime } from "luxon";

export type CustomerBucket = "this_week" | "upcoming" | "recent" | "inactive";

export type CustomerAppointment = {
  id: string;
  starts_at: string;
  status: string;
  serviceName: string;
  artistName: string | null;
};

export type CustomerRecord = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  bucket: CustomerBucket;
  lastFive: CustomerAppointment[];
  monthlyActivity: { month: string; count: number }[];
  distinctActiveMonths: number;
  nextAppointment: CustomerAppointment | null;
  daysSinceLast: number | null;
};

export type LoadCustomersResult = {
  customers: CustomerRecord[];
  /** Whether phone/email were actually resolved, or nulled out for this
   *  viewer's role — lets the UI distinguish "hidden by permission" from
   *  a customer genuinely having no phone/email on file. */
  canSeeContact: boolean;
};

export type RawCustomer = {
  id: string;
  profile_id: string | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

export type RawAppointment = {
  id: string;
  customer_id: string;
  starts_at: string;
  status: string;
  services: { name: string | null } | null;
  salon_memberships: { artist_profiles: { display_name: string } | null } | null;
};

/**
 * The actual privacy/visibility boundary for the customers admin page —
 * everything here is plain data transformation with no DB/network calls,
 * on purpose: this is the one place a stylist's own-customers restriction
 * and a non-owner's contact-info redaction get enforced, and neither is
 * backed by an RLS policy (both roles have full RLS read access to these
 * rows within their own salon), so this function being correct is the
 * whole ballgame. Kept dependency-free so it's directly unit-testable.
 */
export function buildCustomerRecords({
  customers,
  appointments,
  restrictToOwn,
  canSeeContact,
  emailByProfileId,
  timezone,
  now,
}: {
  customers: RawCustomer[];
  appointments: RawAppointment[];
  restrictToOwn: boolean;
  canSeeContact: boolean;
  emailByProfileId: Map<string, string | null>;
  timezone: string;
  now: DateTime;
}): LoadCustomersResult {
  const weekEnd = now.plus({ days: 7 });
  const twelveMonthsAgo = now.minus({ months: 11 }).startOf("month");

  const appointmentsByCustomer = new Map<string, RawAppointment[]>();
  for (const a of appointments) {
    const list = appointmentsByCustomer.get(a.customer_id);
    if (list) list.push(a);
    else appointmentsByCustomer.set(a.customer_id, [a]);
  }

  // Restricted to only the customers that survived the scoped appointments
  // query above — never returned to the page/client for anyone else.
  const visibleCustomers = restrictToOwn
    ? customers.filter((c) => appointmentsByCustomer.has(c.id))
    : customers;

  const records = visibleCustomers.map((c) => {
    const apptsRaw = appointmentsByCustomer.get(c.id) ?? [];
    const appts: CustomerAppointment[] = apptsRaw.map((a) => ({
      id: a.id,
      starts_at: a.starts_at,
      status: a.status,
      serviceName: a.services?.name ?? "Servicio",
      artistName: a.salon_memberships?.artist_profiles?.display_name ?? null,
    }));

    const future = appts
      .filter((a) => (a.status === "pending" || a.status === "confirmed") && DateTime.fromISO(a.starts_at) > now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const completed = appts
      .filter((a) => a.status === "completed")
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

    const nextAppointment = future[0] ?? null;

    let bucket: CustomerBucket;
    let daysSinceLast: number | null = null;

    if (nextAppointment && DateTime.fromISO(nextAppointment.starts_at) <= weekEnd) {
      bucket = "this_week";
    } else if (nextAppointment) {
      bucket = "upcoming";
    } else if (completed.length) {
      const last = DateTime.fromISO(completed[0].starts_at);
      daysSinceLast = Math.floor(now.diff(last, "days").days);
      bucket = daysSinceLast <= 30 ? "recent" : "inactive";
    } else {
      bucket = "inactive";
    }

    const monthCounts = new Map<string, number>();
    for (const a of completed) {
      const d = DateTime.fromISO(a.starts_at).setZone(timezone);
      if (d < twelveMonthsAgo) continue;
      const key = d.toFormat("yyyy-LL");
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }
    const monthlyActivity = Array.from(monthCounts.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, count]) => ({
        month: DateTime.fromFormat(month, "yyyy-LL").setLocale("es").toFormat("LLL yyyy"),
        count,
      }));

    return {
      id: c.id,
      fullName: c.profiles?.full_name ?? "Sin nombre",
      phone: canSeeContact ? (c.profiles?.phone ?? null) : null,
      email: canSeeContact && c.profile_id ? (emailByProfileId.get(c.profile_id) ?? null) : null,
      bucket,
      lastFive: appts.slice(0, 5),
      monthlyActivity,
      distinctActiveMonths: monthCounts.size,
      nextAppointment,
      daysSinceLast,
    };
  });

  return { customers: records, canSeeContact };
}
