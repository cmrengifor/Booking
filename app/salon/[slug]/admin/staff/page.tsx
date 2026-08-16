import { DateTime } from "luxon";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getSalonMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { StaffActions } from "./staff-actions";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  invited: "Invitado",
  disabled: "Deshabilitado",
};

export default async function AdminStaffPage({
  params,
}: PageProps<"/salon/[slug]/admin/staff">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const membership = await getSalonMembership(salon.id);
  const canEdit = membership?.role === "owner" || membership?.role === "manager";

  const supabase = await createClient();
  const [{ data: memberships }, { data: timeOffRows }, { data: analytics }] = await Promise.all([
    supabase
      .from("salon_memberships")
      .select(
        "id, role, status, profiles(full_name), artist_profiles(display_name, bio), staff_weekly_hours(day_of_week, start_time, end_time, break_start, break_end)"
      )
      .eq("salon_id", salon.id)
      .order("role"),
    supabase
      .from("staff_time_off")
      .select("id, salon_membership_id, start_date, end_date, reason")
      .eq("salon_id", salon.id)
      .order("start_date"),
    supabase.from("artist_analytics").select("*").eq("salon_id", salon.id),
  ]);

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
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Panel del salón
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">Staff</h1>
      </div>

      <div className="flex flex-col gap-4">
        {memberships?.map((m) => {
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
                    <p className="font-heading text-lg text-foreground">
                      {m.artist_profiles?.display_name ??
                        m.profiles?.full_name ??
                        "Sin nombre"}
                    </p>
                    <p className="font-sans text-xs text-muted-foreground">
                      {m.role} · {STATUS_LABEL[m.status] ?? m.status} · {light.label}
                    </p>
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
        {!memberships?.length && (
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
