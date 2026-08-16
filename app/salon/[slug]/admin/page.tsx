import { DateTime } from "luxon";
import Link from "next/link";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getSalonMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage({
  params,
}: PageProps<"/salon/[slug]/admin">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  const membership = salon ? await getSalonMembership(salon.id) : null;
  if (!salon) return null;

  const supabase = await createClient();
  const todayStart = DateTime.now().setZone(salon.timezone).startOf("day").toISO();
  const todayEnd = DateTime.now().setZone(salon.timezone).endOf("day").toISO();

  const [
    { data: today },
    { count: openCount },
    { count: pendingConfirmationCount },
    { count: pendingReviewsCount },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, starts_at, status, services(name), service_variants(name), customers(profiles(full_name)), salon_memberships(artist_profiles(display_name))"
      )
      .eq("salon_id", salon.id)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", todayStart!)
      .lte("starts_at", todayEnd!)
      .order("starts_at"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "open"),
    // Not date-scoped, same as openCount — a pending-confirmation appointment
    // still needs Aceptar/Rechazar no matter how far in the past or future
    // it's scheduled, so it shouldn't disappear from Overview just because
    // it isn't today (that was the bug: a 10-day-old pending request was
    // invisible here while still sitting unactioned in Citas).
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "pending"),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "pending"),
  ]);

  const quickLinks = [
    { href: "appointments", label: "Citas" },
    { href: "staff", label: "Staff" },
    { href: "services", label: "Servicios" },
    { href: "reviews", label: "Reseñas" },
    { href: "analytics", label: "Análisis" },
  ];

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Panel del salón
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">{salon.name}</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          Conectado como {membership?.role}.
        </p>
      </div>

      {(openCount ?? 0) > 0 || (pendingConfirmationCount ?? 0) > 0 || (pendingReviewsCount ?? 0) > 0 ? (
        <div className="flex flex-col gap-2">
          {(openCount ?? 0) > 0 && (
            <Link
              href={`/salon/${slug}/admin/appointments`}
              className="rounded-md border border-gold/40 bg-gold/5 px-4 py-3 font-sans text-sm text-foreground hover:border-gold"
            >
              {openCount} cita{openCount === 1 ? "" : "s"} abierta{openCount === 1 ? "" : "s"} sin tomar
            </Link>
          )}
          {(pendingConfirmationCount ?? 0) > 0 && (
            <Link
              href={`/salon/${slug}/admin/appointments`}
              className="rounded-md border border-gold/40 bg-gold/5 px-4 py-3 font-sans text-sm text-foreground hover:border-gold"
            >
              {pendingConfirmationCount} cita{pendingConfirmationCount === 1 ? "" : "s"} pendiente
              {pendingConfirmationCount === 1 ? "" : "s"} de confirmación
            </Link>
          )}
          {(pendingReviewsCount ?? 0) > 0 && (
            <Link
              href={`/salon/${slug}/admin/reviews`}
              className="rounded-md border border-gold/40 bg-gold/5 px-4 py-3 font-sans text-sm text-foreground hover:border-gold"
            >
              {pendingReviewsCount} reseña{pendingReviewsCount === 1 ? "" : "s"} pendiente
              {pendingReviewsCount === 1 ? "" : "s"} de moderación
            </Link>
          )}
        </div>
      ) : null}

      <div>
        <h2 className="font-heading text-lg text-foreground">Citas de hoy</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {(today ?? []).map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3 font-sans text-sm"
            >
              <div>
                <p className="text-foreground">
                  {a.services?.name}
                  {a.service_variants?.name && ` — ${a.service_variants.name}`}
                </p>
                <p className="text-muted-foreground">
                  {DateTime.fromISO(a.starts_at).setZone(salon.timezone).toFormat("HH:mm")} ·{" "}
                  {a.customers?.profiles?.full_name ?? "Cliente"} ·{" "}
                  {a.salon_memberships?.artist_profiles?.display_name ?? "Cualquier artista"}
                </p>
              </div>
            </li>
          ))}
          {!today?.length && (
            <p className="font-sans text-sm text-muted-foreground">
              No hay citas confirmadas o pendientes para hoy.
            </p>
          )}
        </ul>
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Accesos directos</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={`/salon/${slug}/admin/${link.href}`}
              className="rounded-full border border-border px-4 py-2 font-sans text-sm text-muted-foreground hover:border-gold hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
