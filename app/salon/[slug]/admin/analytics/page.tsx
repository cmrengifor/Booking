import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAnalyticsPage({
  params,
}: PageProps<"/salon/[slug]/admin/analytics">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const supabase = await createClient();
  const [{ data: summary }, { data: services }, { data: artists }, { data: hours }] =
    await Promise.all([
      supabase.from("salon_analytics_summary").select("*").eq("salon_id", salon.id).maybeSingle(),
      supabase
        .from("service_analytics")
        .select("*")
        .eq("salon_id", salon.id)
        .order("revenue", { ascending: false }),
      supabase
        .from("artist_analytics")
        .select("*")
        .eq("salon_id", salon.id)
        .order("revenue", { ascending: false }),
      supabase
        .from("peak_booking_hours")
        .select("*")
        .eq("salon_id", salon.id)
        .order("hour_of_day"),
    ]);

  const totalTerminal =
    (summary?.completed_appointments ?? 0) +
    (summary?.cancelled_appointments ?? 0) +
    (summary?.no_show_appointments ?? 0);
  const cancellationRate = totalTerminal
    ? Math.round(((summary?.cancelled_appointments ?? 0) / totalTerminal) * 100)
    : 0;
  const noShowRate = totalTerminal
    ? Math.round(((summary?.no_show_appointments ?? 0) / totalTerminal) * 100)
    : 0;

  const maxServiceRevenue = Math.max(1, ...(services ?? []).map((s) => Number(s.revenue ?? 0)));
  const maxHourCount = Math.max(1, ...(hours ?? []).map((h) => h.appointment_count ?? 0));

  return (
    <div className="flex flex-col gap-10 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Panel del salón
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">Analytics</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Ingresos" value={`$${summary?.total_revenue ?? 0}`} />
        <Kpi label="Citas completadas" value={String(summary?.completed_appointments ?? 0)} />
        <Kpi label="Clientes" value={String(summary?.total_customers ?? 0)} />
        <Kpi label="Ticket promedio" value={`$${summary?.avg_ticket ?? 0}`} />
        <Kpi label="Tasa de cancelación" value={`${cancellationRate}%`} />
        <Kpi label="Tasa de no-show" value={`${noShowRate}%`} />
        <Kpi
          label="Calificación promedio"
          value={summary?.avg_review_rating != null ? `${summary.avg_review_rating} ★` : "—"}
        />
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Ingresos por servicio</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {services?.map((s) => (
            <li key={s.service_id} className="flex items-center gap-3 font-sans text-sm">
              <span className="w-32 shrink-0 truncate text-foreground">{s.service_name}</span>
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-gold"
                  style={{ width: `${(Number(s.revenue ?? 0) / maxServiceRevenue) * 100}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground">
                ${s.revenue}
              </span>
            </li>
          ))}
          {!services?.length && (
            <p className="font-sans text-sm text-muted-foreground">Sin datos todavía.</p>
          )}
        </ul>
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Por artista</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {artists?.map((a) => (
            <li
              key={a.salon_membership_id}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3 font-sans text-sm"
            >
              <span className="text-foreground">{a.display_name}</span>
              <span className="text-muted-foreground">
                {a.completed_count} citas · ${a.revenue}
                {a.avg_rating != null && ` · ${a.avg_rating} ★`}
              </span>
            </li>
          ))}
          {!artists?.length && (
            <p className="font-sans text-sm text-muted-foreground">Sin datos todavía.</p>
          )}
        </ul>
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Horas pico</h2>
        <div className="mt-4 flex items-end gap-1">
          {hours?.map((h) => (
            <div key={h.hour_of_day} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm bg-gold"
                style={{ height: `${((h.appointment_count ?? 0) / maxHourCount) * 80 + 4}px` }}
              />
              <span className="font-mono text-[0.65rem] text-muted-foreground">
                {h.hour_of_day}h
              </span>
            </div>
          ))}
          {!hours?.length && (
            <p className="font-sans text-sm text-muted-foreground">Sin datos todavía.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="font-mono text-2xl text-foreground">{value}</p>
      <p className="mt-1 font-sans text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
