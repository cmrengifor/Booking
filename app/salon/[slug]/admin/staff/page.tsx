import { DateTime } from "luxon";
import Link from "next/link";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getSalonMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { assertNoQueryErrors } from "@/lib/supabase/assert";
import { StaffActions } from "./staff-actions";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Cycled by each location's position (sort_order) so the color stays
// stable across renders without hard-coding per-location assignments.
const LOCATION_COLORS = [
  "bg-sky-500/15 text-sky-600",
  "bg-pink-500/15 text-pink-600",
  "bg-amber-500/15 text-amber-700",
  "bg-teal-500/15 text-teal-600",
  "bg-indigo-500/15 text-indigo-600",
  "bg-rose-500/15 text-rose-600",
];

const ROLE_LABEL: Record<string, string> = {
  owner: "Dueño/a",
  manager: "Manager",
  receptionist: "Recepción",
  stylist: "Artista",
};

const ROLE_BADGE_CLASS: Record<string, string> = {
  owner: "bg-gold/15 text-gold",
  manager: "bg-blue-500/15 text-blue-600",
  receptionist: "bg-purple-500/15 text-purple-600",
  stylist: "bg-emerald-500/15 text-emerald-600",
};

export default async function AdminStaffPage({
  params,
  searchParams,
}: PageProps<"/salon/[slug]/admin/staff">) {
  const { slug } = await params;
  const sp = await searchParams;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const membership = await getSalonMembership(salon.id);
  const canEdit = membership?.role === "owner" || membership?.role === "manager";
  const locationFilter = typeof sp.location === "string" ? sp.location : null;

  const supabase = await createClient();
  const [membershipsRes, timeOffRes, analyticsRes, locationsRes] = await Promise.all([
    supabase
      .from("salon_memberships")
      .select(
        "id, role, status, location_id, profiles(full_name), artist_profiles(display_name, bio), staff_weekly_hours(day_of_week, start_time, end_time, break_start, break_end)"
      )
      .eq("salon_id", salon.id)
      .order("role"),
    supabase
      .from("staff_time_off")
      .select("id, salon_membership_id, start_date, end_date, reason")
      .eq("salon_id", salon.id)
      .order("start_date"),
    supabase.from("artist_analytics").select("*").eq("salon_id", salon.id),
    supabase
      .from("salon_locations")
      .select("id, name")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order"),
  ]);
  assertNoQueryErrors([membershipsRes, timeOffRes, analyticsRes, locationsRes], "Failed to load staff");
  const { data: memberships } = membershipsRes;
  const { data: timeOffRows } = timeOffRes;
  const { data: analytics } = analyticsRes;
  const { data: locations } = locationsRes;

  const locationColor = new Map((locations ?? []).map((l, i) => [l.id, LOCATION_COLORS[i % LOCATION_COLORS.length]]));
  const locationName = new Map((locations ?? []).map((l) => [l.id, l.name]));
  const visibleMemberships = locationFilter
    ? (memberships ?? []).filter((m) => m.location_id === locationFilter)
    : (memberships ?? []);

  const today = DateTime.now().setZone(salon.timezone).toISODate() ?? "";

  function trafficLight(status: string, membershipId: string) {
    if (status === "disabled") return { color: "bg-red-500", label: "Deshabilitado" };
    const onLeave = timeOffRows?.some(
      (t) => t.salon_membership_id === membershipId && t.start_date <= today && today <= t.end_date
    );
    if (onLeave) return { color: "bg-amber-400", label: "Vacaciones" };
    return { color: "bg-emerald-500", label: "Activo" };
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
            Panel del salón
          </p>
          <h1 className="mt-2 font-heading text-3xl text-foreground">Staff</h1>
        </div>
        {(locations?.length ?? 0) > 1 && (
          <div className="flex flex-wrap gap-1">
            <Link
              href={`/salon/${slug}/admin/staff`}
              className={`rounded-md px-3 py-1.5 font-sans text-xs transition-colors ${
                !locationFilter
                  ? "bg-primary text-primary-foreground"
                  : "border border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              Todas las sedes
            </Link>
            {locations?.map((l) => (
              <Link
                key={l.id}
                href={`/salon/${slug}/admin/staff?location=${l.id}`}
                className={`rounded-md px-3 py-1.5 font-sans text-xs transition-colors ${
                  locationFilter === l.id
                    ? "bg-primary text-primary-foreground"
                    : "border border-input text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {visibleMemberships.map((m) => {
          const light = trafficLight(m.status, m.id);
          const stats = analytics?.find((a) => a.salon_membership_id === m.id);
          const memberTimeOff = timeOffRows?.filter((t) => t.salon_membership_id === m.id) ?? [];

          return (
            <div key={m.id} className="rounded-md border border-border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 size-2.5 shrink-0 rounded-full ${light.color}`}
                    title={light.label}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-heading text-lg text-foreground">
                        {m.artist_profiles?.display_name ??
                          m.profiles?.full_name ??
                          "Sin nombre"}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 font-sans text-[11px] font-medium ${
                          ROLE_BADGE_CLASS[m.role] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                      {m.location_id && locationName.get(m.location_id) && (
                        <span
                          className={`rounded-full px-2 py-0.5 font-sans text-[11px] font-medium ${
                            locationColor.get(m.location_id) ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {locationName.get(m.location_id)}
                        </span>
                      )}
                    </div>
                    <p className="font-sans text-xs text-muted-foreground">{light.label}</p>
                    {(stats?.completed_count != null || stats?.avg_rating != null) && (
                      <p className="mt-1 font-sans text-xs text-muted-foreground">
                        {stats?.completed_count ?? 0} citas completadas
                        {stats?.avg_rating != null && ` · ${stats.avg_rating} ★`}
                      </p>
                    )}
                  </div>
                </div>
                {canEdit && m.artist_profiles && (
                  <StaffActions
                    membershipId={m.id}
                    salonId={salon.id}
                    slug={slug}
                    displayName={m.artist_profiles.display_name}
                    bio={m.artist_profiles.bio ?? ""}
                    hours={m.staff_weekly_hours ?? []}
                    timeOff={memberTimeOff}
                    disabled={m.status === "disabled"}
                  />
                )}
              </div>
              {m.artist_profiles?.bio && (
                <p className="mt-2 font-sans text-sm text-muted-foreground">
                  {m.artist_profiles.bio}
                </p>
              )}
              {m.staff_weekly_hours?.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {m.staff_weekly_hours
                    .sort((a, b) => a.day_of_week - b.day_of_week)
                    .map((h) => (
                      <li
                        key={h.day_of_week}
                        className="rounded-md bg-muted/40 px-2 py-1 font-sans text-xs text-muted-foreground"
                      >
                        {DAY_LABELS[h.day_of_week]} {h.start_time.slice(0, 5)}–
                        {h.end_time.slice(0, 5)}
                        {h.break_start &&
                          ` (break ${h.break_start.slice(0, 5)}–${h.break_end?.slice(0, 5)})`}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-3 font-sans text-xs text-muted-foreground">
                  Sin horario configurado.
                </p>
              )}
            </div>
          );
        })}
        {!visibleMemberships.length && (
          <p className="font-sans text-sm text-muted-foreground">
            No hay staff todavía.
          </p>
        )}
      </div>

      {!canEdit && (
        <p className="font-sans text-xs text-muted-foreground">
          Solo el owner o manager pueden editar la información y los horarios del staff.
        </p>
      )}
    </div>
  );
}
