import "server-only";
import { DateTime } from "luxon";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNoQueryErrors } from "@/lib/supabase/assert";
import { canViewAllCustomers, canViewCustomerContactInfo } from "@/lib/auth/permissions";
import type { Tables } from "@/types/database";
import { buildCustomerRecords } from "./build-records";

export type {
  CustomerBucket,
  CustomerAppointment,
  CustomerRecord,
  LoadCustomersResult,
} from "./build-records";

type Viewer = Pick<Tables<"salon_memberships">, "id" | "role"> | null | undefined;

export async function loadCustomers(
  salonId: string,
  timezone: string,
  viewer: Viewer
) {
  const supabase = await createClient();

  const now = DateTime.now().setZone(timezone);
  const twelveMonthsAgo = now.minus({ months: 11 }).startOf("month");

  // A stylist only sees customers tied to their own appointments — scope
  // the appointments fetch itself to just theirs, both so the bucketing
  // below is correct (no leaking a shared client's visits with a
  // colleague into "their" history) and so the customer list can be
  // derived from exactly this set below, with no separate query needed.
  const restrictToOwn = !canViewAllCustomers(viewer);
  const canSeeContact = canViewCustomerContactInfo(viewer);

  const [customersRes, appointmentsRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, profile_id, profiles(full_name, phone)")
      .eq("salon_id", salonId),
    (() => {
      let query = supabase
        .from("appointments")
        .select(
          "id, customer_id, starts_at, status, services(name), salon_memberships(artist_profiles(display_name))"
        )
        .eq("salon_id", salonId)
        // Bounded to the same 12-month window monthlyActivity already buckets
        // into (was previously the entire history of the salon, unbounded,
        // re-fetched and re-filtered per customer on every page load). A
        // customer whose last visit predates this window still correctly
        // lands in "inactive" (the bucket logic's own fallback for "no
        // completed appointment found"), just without a precise
        // daysSinceLast — an acceptable trade for a salon that's been
        // dormant with them for over a year. Future appointments have no
        // upper bound, since only a handful exist at any time.
        .gte("starts_at", twelveMonthsAgo.toUTC().toISO()!)
        .order("starts_at", { ascending: false });
      if (restrictToOwn && viewer) query = query.eq("salon_membership_id", viewer.id);
      return query;
    })(),
  ]);
  assertNoQueryErrors([customersRes, appointmentsRes], "Failed to load customers");
  const { data: customers } = customersRes;
  const { data: appointments } = appointmentsRes;

  // Same restriction buildCustomerRecords applies below, needed here only
  // to scope which customers get an email lookup at all.
  const appointmentCustomerIds = new Set((appointments ?? []).map((a) => a.customer_id));
  const visibleCustomers = restrictToOwn
    ? (customers ?? []).filter((c) => appointmentCustomerIds.has(c.id))
    : (customers ?? []);

  const admin = createAdminClient();
  // Scoped, per-customer lookups instead of a platform-wide listUsers(1000)
  // page — this salon's customer count, not every auth user on the
  // platform, and no silent cap once total platform users exceed 1000.
  // Same pattern already used correctly for single lookups elsewhere in
  // this directory (actions.ts). Skipped entirely when the viewer can't
  // see contact info anyway — no reason to make the admin-API calls.
  const emailEntries = canSeeContact
    ? await Promise.all(
        visibleCustomers.map(async (c) => {
          if (!c.profile_id) return null;
          const { data } = await admin.auth.admin.getUserById(c.profile_id);
          return [c.profile_id, data.user?.email ?? null] as const;
        })
      )
    : [];
  const emailByProfileId = new Map(emailEntries.filter((e) => e !== null));

  return buildCustomerRecords({
    customers: customers ?? [],
    appointments: appointments ?? [],
    restrictToOwn,
    canSeeContact,
    emailByProfileId,
    timezone,
    now,
  });
}
