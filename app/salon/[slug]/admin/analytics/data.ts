import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRange, type RangeMode } from "./range";

export type AnalyticsFilter = {
  mode: RangeMode;
  refDate: string;
  serviceId: string | null;
  artistId?: string | null;
};

export async function loadAnalytics(
  salonId: string,
  timezone: string,
  filter: AnalyticsFilter
) {
  const { start, end } = getRange(filter.mode, filter.refDate, timezone);
  const supabase = await createClient();

  let query = supabase
    .from("appointments")
    .select(
      "id, status, price, amount_paid, starts_at, customer_id, service_id, salon_membership_id, services(name, artist_split_percent), salon_memberships(artist_profiles(display_name))"
    )
    .eq("salon_id", salonId)
    .gte("starts_at", start.toUTC().toISO()!)
    .lte("starts_at", end.toUTC().toISO()!);
  if (filter.serviceId) query = query.eq("service_id", filter.serviceId);
  if (filter.artistId) query = query.eq("salon_membership_id", filter.artistId);

  const [{ data: appointments }, { data: reviews }] = await Promise.all([
    query,
    supabase
      .from("reviews")
      .select("rating, salon_membership_id, created_at")
      .eq("salon_id", salonId)
      .eq("status", "published")
      .gte("created_at", start.toUTC().toISO()!)
      .lte("created_at", end.toUTC().toISO()!),
  ]);

  const rows = appointments ?? [];
  const completed = rows.filter((r) => r.status === "completed");
  const cancelled = rows.filter((r) => r.status === "cancelled");
  const noShow = rows.filter((r) => r.status === "no_show");
  const totalRevenue = completed.reduce((sum, r) => sum + Number(r.amount_paid ?? 0), 0);
  const distinctCustomers = new Set(rows.map((r) => r.customer_id)).size;
  const totalTerminal = completed.length + cancelled.length + noShow.length;

  const serviceMap = new Map<
    string,
    { id: string; name: string; count: number; revenue: number; splitPercent: number }
  >();
  for (const r of completed) {
    const id = r.service_id;
    const name = r.services?.name ?? "Servicio";
    const splitPercent = r.services?.artist_split_percent ?? 50;
    const entry = serviceMap.get(id) ?? { id, name, count: 0, revenue: 0, splitPercent };
    entry.count += 1;
    entry.revenue += Number(r.amount_paid ?? 0);
    serviceMap.set(id, entry);
  }

  const artistMap = new Map<string, { id: string; name: string; count: number; revenue: number }>();
  for (const r of completed) {
    if (!r.salon_membership_id) continue;
    const id = r.salon_membership_id;
    const name = r.salon_memberships?.artist_profiles?.display_name ?? "—";
    const entry = artistMap.get(id) ?? { id, name, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += Number(r.amount_paid ?? 0);
    artistMap.set(id, entry);
  }

  const ratingsByArtist = new Map<string, number[]>();
  for (const rv of reviews ?? []) {
    if (!rv.salon_membership_id) continue;
    const list = ratingsByArtist.get(rv.salon_membership_id) ?? [];
    list.push(rv.rating);
    ratingsByArtist.set(rv.salon_membership_id, list);
  }
  function average(nums: number[]) {
    return nums.length ? Math.round((nums.reduce((s, x) => s + x, 0) / nums.length) * 100) / 100 : null;
  }

  const artists = Array.from(artistMap.values())
    .map((a) => ({ ...a, avgRating: average(ratingsByArtist.get(a.id) ?? []) }))
    .sort((a, b) => b.revenue - a.revenue);

  const services = Array.from(serviceMap.values())
    .map((s) => ({
      ...s,
      artistEarned: Math.round(((s.revenue * s.splitPercent) / 100) * 100) / 100,
      businessEarned: Math.round(((s.revenue * (100 - s.splitPercent)) / 100) * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    start,
    end,
    appointments: rows,
    completedCount: completed.length,
    cancelledCount: cancelled.length,
    noShowCount: noShow.length,
    totalRevenue,
    avgTicket: completed.length ? Math.round((totalRevenue / completed.length) * 100) / 100 : 0,
    cancellationRate: totalTerminal ? Math.round((cancelled.length / totalTerminal) * 100) : 0,
    noShowRate: totalTerminal ? Math.round((noShow.length / totalTerminal) * 100) : 0,
    distinctCustomers,
    avgRating: average((reviews ?? []).map((r) => r.rating)),
    services,
    artists,
  };
}

export function parseFilter(searchParams: {
  range?: string;
  ref?: string;
  service?: string;
}): { mode: RangeMode; refDate: string; serviceId: string | null } {
  const mode: RangeMode =
    searchParams.range && ["day", "week", "month", "quarter", "semester"].includes(searchParams.range)
      ? (searchParams.range as RangeMode)
      : "month";
  return {
    mode,
    refDate: searchParams.ref ?? "",
    serviceId: searchParams.service && searchParams.service !== "all" ? searchParams.service : null,
  };
}
