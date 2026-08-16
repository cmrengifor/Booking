import Link from "next/link";
import { DateTime } from "luxon";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";
import { loadAnalytics, parseFilter } from "./data";
import { AnalyticsFilters } from "./filter-bar";

// Fictional demo data for the peak-hours chart — the real peak_booking_hours
// view only has bars for hours with actual appointments, which reads as
// sparse/confusing with this salon's small seed dataset. Fixed 8am-8pm
// segments read better for a live presentation than a mostly-empty real
// chart, and stay constant regardless of the date filter (explicit ask).
const PEAK_HOURS_DEMO = [
  { hour: 8, count: 2 },
  { hour: 9, count: 4 },
  { hour: 10, count: 7 },
  { hour: 11, count: 9 },
  { hour: 12, count: 6 },
  { hour: 13, count: 5 },
  { hour: 14, count: 8 },
  { hour: 15, count: 11 },
  { hour: 16, count: 13 },
  { hour: 17, count: 10 },
  { hour: 18, count: 7 },
  { hour: 19, count: 3 },
];

export default async function AdminAnalyticsPage({
  params,
  searchParams,
}: PageProps<"/salon/[slug]/admin/analytics">) {
  const { slug } = await params;
  const sp = await searchParams;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const filter = parseFilter(sp);
  const todayIso = DateTime.now().setZone(salon.timezone).toISODate() ?? "";

  const supabase = await createClient();
  const [{ data: services }, analytics] = await Promise.all([
    supabase
      .from("services")
      .select("id, name")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order"),
    loadAnalytics(salon.id, salon.timezone, filter),
  ]);

  const qs = new URLSearchParams();
  qs.set("range", filter.mode);
  qs.set("ref", filter.refDate || todayIso);
  if (filter.serviceId) qs.set("service", filter.serviceId);
  const carry = qs.toString();

  const maxServiceRevenue = Math.max(1, ...analytics.services.map((s) => s.revenue));
  const maxHourCount = Math.max(1, ...PEAK_HOURS_DEMO.map((h) => h.count));

  const topCompleted = [...analytics.artists].sort((a, b) => b.count - a.count).slice(0, 3);
  const topRevenue = [...analytics.artists].sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  const topRated = [...analytics.artists]
    .filter((a) => a.avgRating != null)
    .sort((a, b) => Number(b.avgRating) - Number(a.avgRating))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-10 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Panel del salón
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">Análisis</h1>
      </div>

      <AnalyticsFilters services={services ?? []} todayIso={todayIso} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link href={`/salon/${slug}/admin/analytics/by-artist?metric=revenue&${carry}`}>
          <Kpi label="Ingresos" value={`$${analytics.totalRevenue}`} interactive />
        </Link>
        <Link href={`/salon/${slug}/admin/analytics/by-artist?metric=completed&${carry}`}>
          <Kpi label="Citas completadas" value={String(analytics.completedCount)} interactive />
        </Link>
        <Kpi label="Clientes" value={String(analytics.distinctCustomers)} />
        <Kpi label="Ticket promedio" value={`$${analytics.avgTicket}`} />
        <Kpi label="Tasa de cancelación" value={`${analytics.cancellationRate}%`} />
        <Kpi label="Tasa de no-show" value={`${analytics.noShowRate}%`} />
        <Kpi
          label="Calificación promedio"
          value={analytics.avgRating != null ? `${analytics.avgRating} ★` : "—"}
        />
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Ingresos por servicio</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {analytics.services.map((s) => (
            <li key={s.id} className="flex items-center gap-3 font-sans text-sm">
              <span className="w-32 shrink-0 truncate text-foreground">{s.name}</span>
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-gold"
                  style={{ width: `${(s.revenue / maxServiceRevenue) * 100}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground">
                ${s.revenue}
              </span>
            </li>
          ))}
          {!analytics.services.length && (
            <p className="font-sans text-sm text-muted-foreground">Sin datos en este rango.</p>
          )}
        </ul>
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Split por servicio</h2>
        <p className="mt-1 font-sans text-xs text-muted-foreground">
          Lo que gana cada artista frente a lo que gana el negocio, según el % configurado por servicio.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {analytics.services.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-md border border-border px-4 py-2 font-sans text-sm"
            >
              <span className="text-foreground">
                {s.name} <span className="text-muted-foreground">({s.splitPercent}% artista)</span>
              </span>
              <span className="text-muted-foreground">
                Artista ${s.artistEarned} · Negocio ${s.businessEarned}
              </span>
            </li>
          ))}
          {!analytics.services.length && (
            <p className="font-sans text-sm text-muted-foreground">Sin datos en este rango.</p>
          )}
        </ul>
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Top artistas</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <RankingCard
            title="Citas completadas"
            entries={topCompleted.map((a) => ({ id: a.id, name: a.name, value: `${a.count} citas` }))}
            slug={slug}
            carry={carry}
          />
          <RankingCard
            title="Dinero recolectado"
            entries={topRevenue.map((a) => ({ id: a.id, name: a.name, value: `$${a.revenue}` }))}
            slug={slug}
            carry={carry}
          />
          <RankingCard
            title="Mejor valorados"
            entries={topRated.map((a) => ({ id: a.id, name: a.name, value: `${a.avgRating} ★` }))}
            slug={slug}
            carry={carry}
          />
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Por artista</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {analytics.artists.map((a) => (
            <li key={a.id}>
              <Link
                href={`/salon/${slug}/admin/analytics/artist/${a.id}?${carry}`}
                className="flex items-center justify-between rounded-md border border-border px-4 py-3 font-sans text-sm transition-colors hover:border-gold"
              >
                <span className="text-foreground">{a.name}</span>
                <span className="text-muted-foreground">
                  {a.count} citas · ${a.revenue}
                  {a.avgRating != null && ` · ${a.avgRating} ★`}
                </span>
              </Link>
            </li>
          ))}
          {!analytics.artists.length && (
            <p className="font-sans text-sm text-muted-foreground">Sin datos en este rango.</p>
          )}
        </ul>
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Horas pico</h2>
        <div className="mt-4 flex items-end gap-2">
          {PEAK_HOURS_DEMO.map((h) => (
            <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm bg-gold"
                style={{ height: `${(h.count / maxHourCount) * 80 + 4}px` }}
              />
              <span className="font-mono text-[0.65rem] text-muted-foreground">{h.hour}h</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  interactive,
}: {
  label: string;
  value: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-border p-4 ${
        interactive ? "cursor-pointer transition-colors hover:border-gold" : ""
      }`}
    >
      <p className="font-mono text-2xl text-foreground">{value}</p>
      <p className="mt-1 font-sans text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function RankingCard({
  title,
  entries,
  slug,
  carry,
}: {
  title: string;
  entries: { id: string; name: string; value: string }[];
  slug: string;
  carry: string;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <h3 className="font-sans text-sm font-medium text-foreground">{title}</h3>
      <ol className="mt-3 flex flex-col gap-2">
        {entries.map((e, i) => (
          <li key={e.id}>
            <Link
              href={`/salon/${slug}/admin/analytics/artist/${e.id}?${carry}`}
              className="flex items-center justify-between font-sans text-sm text-muted-foreground hover:text-foreground"
            >
              <span>
                {i + 1}. {e.name}
              </span>
              <span className="font-mono text-xs">{e.value}</span>
            </Link>
          </li>
        ))}
        {!entries.length && (
          <p className="font-sans text-xs text-muted-foreground">Sin datos en este rango.</p>
        )}
      </ol>
    </div>
  );
}
