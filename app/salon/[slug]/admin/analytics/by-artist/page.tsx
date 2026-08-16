import Link from "next/link";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { loadAnalytics, parseFilter } from "../data";

export default async function AnalyticsByArtistPage({
  params,
  searchParams,
}: PageProps<"/salon/[slug]/admin/analytics/by-artist">) {
  const { slug } = await params;
  const sp = await searchParams;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const byCompleted = sp.metric === "completed";
  const filter = parseFilter(sp);
  const analytics = await loadAnalytics(salon.id, salon.timezone, filter);

  const qs = new URLSearchParams();
  qs.set("range", filter.mode);
  if (filter.refDate) qs.set("ref", filter.refDate);
  if (filter.serviceId) qs.set("service", filter.serviceId);
  const carry = qs.toString();

  const rows = analytics.artists;
  const max = Math.max(1, ...rows.map((a) => (byCompleted ? a.count : a.revenue)));

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Panel del salón
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">
          {byCompleted ? "Citas completadas" : "Ingresos"} por artista
        </h1>
        <Link
          href={`/salon/${slug}/admin/analytics?${carry}`}
          className="mt-1 inline-block font-sans text-xs text-muted-foreground hover:text-foreground"
        >
          ← Volver a Análisis
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((a) => {
          const value = byCompleted ? a.count : a.revenue;
          return (
            <li key={a.id}>
              <Link
                href={`/salon/${slug}/admin/analytics/artist/${a.id}?${carry}`}
                className="flex items-center gap-3 rounded-md border border-border px-4 py-3 font-sans text-sm transition-colors hover:border-gold"
              >
                <span className="w-32 shrink-0 truncate text-foreground">{a.name}</span>
                <div className="h-2 flex-1 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-gold"
                    style={{ width: `${(value / max) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-xs text-muted-foreground">
                  {byCompleted ? `${value} citas` : `$${value}`}
                </span>
              </Link>
            </li>
          );
        })}
        {!rows.length && (
          <p className="font-sans text-sm text-muted-foreground">Sin datos en este rango.</p>
        )}
      </ul>
    </div>
  );
}
