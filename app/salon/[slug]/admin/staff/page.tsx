import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default async function AdminStaffPage({
  params,
}: PageProps<"/salon/[slug]/admin/staff">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("salon_memberships")
    .select(
      "id, role, status, profiles(full_name), artist_profiles(display_name, bio), staff_weekly_hours(day_of_week, start_time, end_time, break_start, break_end)"
    )
    .eq("salon_id", salon.id)
    .order("role");

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Panel del salón
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">Staff</h1>
        <p className="mt-1 font-sans text-xs text-muted-foreground">
          Edición de horarios llega junto con la Fase 7. Por ahora es
          lectura.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {memberships?.map((m) => (
          <div key={m.id} className="rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-heading text-lg text-foreground">
                  {m.artist_profiles?.display_name ??
                    m.profiles?.full_name ??
                    "Sin nombre"}
                </p>
                <p className="font-sans text-xs text-muted-foreground">
                  {m.role} · {m.status}
                </p>
              </div>
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
        ))}
        {!memberships?.length && (
          <p className="font-sans text-sm text-muted-foreground">
            No hay staff todavía.
          </p>
        )}
      </div>
    </div>
  );
}
