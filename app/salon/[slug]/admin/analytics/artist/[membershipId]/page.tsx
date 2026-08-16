import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";
import { loadAnalytics, parseFilter } from "../../data";

export default async function ArtistInsightPage({
  params,
  searchParams,
}: PageProps<"/salon/[slug]/admin/analytics/artist/[membershipId]">) {
  const { slug, membershipId } = await params;
  const sp = await searchParams;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const filter = parseFilter(sp);
  const supabase = await createClient();

  const [analytics, { data: name }, { data: reviews }] = await Promise.all([
    loadAnalytics(salon.id, salon.timezone, { ...filter, artistId: membershipId }),
    supabase
      .from("artist_profiles")
      .select("display_name")
      .eq("salon_membership_id", membershipId)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, customers(profiles(full_name))")
      .eq("salon_id", salon.id)
      .eq("salon_membership_id", membershipId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!name) notFound();

  const qs = new URLSearchParams();
  qs.set("range", filter.mode);
  if (filter.refDate) qs.set("ref", filter.refDate);
  if (filter.serviceId) qs.set("service", filter.serviceId);
  const carry = qs.toString();

  const maxServiceRevenue = Math.max(1, ...analytics.services.map((s) => s.revenue));

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Panel del salón
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">{name.display_name}</h1>
        <Link
          href={`/salon/${slug}/admin/analytics?${carry}`}
          className="mt-1 inline-block font-sans text-xs text-muted-foreground hover:text-foreground"
        >
          ← Volver a Análisis
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-md border border-border p-4">
          <p className="font-mono text-2xl text-foreground">{analytics.completedCount}</p>
          <p className="mt-1 font-sans text-xs text-muted-foreground">Citas completadas</p>
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="font-mono text-2xl text-foreground">${analytics.totalRevenue}</p>
          <p className="mt-1 font-sans text-xs text-muted-foreground">Dinero recolectado</p>
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="font-mono text-2xl text-foreground">
            {analytics.avgRating != null ? `${analytics.avgRating} ★` : "—"}
          </p>
          <p className="mt-1 font-sans text-xs text-muted-foreground">Calificación promedio</p>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Desglose por servicio</h2>
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
              <span className="w-28 shrink-0 text-right font-mono text-xs text-muted-foreground">
                {s.count} · ${s.revenue}
              </span>
            </li>
          ))}
          {!analytics.services.length && (
            <p className="font-sans text-sm text-muted-foreground">Sin citas completadas en este rango.</p>
          )}
        </ul>
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Reseñas recientes</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {reviews?.map((r) => (
            <li key={r.id} className="rounded-md border border-border px-4 py-3 font-sans text-sm">
              <p className="text-foreground">
                {"★".repeat(r.rating)} — {r.customers?.profiles?.full_name ?? "Cliente"} ·{" "}
                {DateTime.fromISO(r.created_at).setZone(salon.timezone).setLocale("es").toFormat("d LLL yyyy")}
              </p>
              {r.comment && <p className="text-muted-foreground">{r.comment}</p>}
            </li>
          ))}
          {!reviews?.length && (
            <p className="font-sans text-sm text-muted-foreground">Sin reseñas publicadas todavía.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
