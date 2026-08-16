import "server-only";
import { DateTime } from "luxon";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function loadCustomers(salonId: string, timezone: string): Promise<CustomerRecord[]> {
  const supabase = await createClient();

  const [{ data: customers }, { data: appointments }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, profile_id, profiles(full_name, phone)")
      .eq("salon_id", salonId),
    supabase
      .from("appointments")
      .select(
        "id, customer_id, starts_at, status, services(name), salon_memberships(artist_profiles(display_name))"
      )
      .eq("salon_id", salonId)
      .order("starts_at", { ascending: false }),
  ]);

  const admin = createAdminClient();
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailByProfileId = new Map(usersPage?.users.map((u) => [u.id, u.email ?? null]) ?? []);

  const now = DateTime.now().setZone(timezone);
  const weekEnd = now.plus({ days: 7 });
  const twelveMonthsAgo = now.minus({ months: 11 }).startOf("month");

  return (customers ?? []).map((c) => {
    const apptsRaw = (appointments ?? []).filter((a) => a.customer_id === c.id);
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
      phone: c.profiles?.phone ?? null,
      email: c.profile_id ? (emailByProfileId.get(c.profile_id) ?? null) : null,
      bucket,
      lastFive: appts.slice(0, 5),
      monthlyActivity,
      distinctActiveMonths: monthCounts.size,
      nextAppointment,
      daysSinceLast,
    };
  });
}
