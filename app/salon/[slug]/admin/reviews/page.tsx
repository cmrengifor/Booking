import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getSalonMembership } from "@/lib/auth/session";
import { canModerateReviews } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { moderateReview } from "./actions";

export default async function AdminReviewsPage({
  params,
}: PageProps<"/salon/[slug]/admin/reviews">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const membership = await getSalonMembership(salon.id);
  // Moderation is owner/manager-only at the RLS level — hide the buttons
  // for other roles instead of showing controls that error on submit.
  const canModerate = canModerateReviews(membership);

  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      "id, rating, comment, status, customers(profiles(full_name)), salon_memberships(artist_profiles(display_name))"
    )
    .eq("salon_id", salon.id)
    .order("created_at", { ascending: false });

  const pending = (reviews ?? []).filter((r) => r.status === "pending");
  const moderated = (reviews ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Panel del salón
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">Reseñas</h1>
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">
          Pendientes de moderación ({pending.length})
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {pending.map((r) => (
            <li key={r.id} className="rounded-md border border-border px-4 py-3 font-sans text-sm">
              <p className="text-foreground">
                {"★".repeat(r.rating)} — {r.customers?.profiles?.full_name} sobre{" "}
                {r.salon_memberships?.artist_profiles?.display_name}
              </p>
              {r.comment && <p className="text-muted-foreground">{r.comment}</p>}
              {canModerate ? (
                <div className="mt-2 flex gap-2">
                  <form action={moderateReview.bind(null, r.id, "published", slug)}>
                    <Button size="sm" type="submit">Publicar</Button>
                  </form>
                  <form action={moderateReview.bind(null, r.id, "rejected", slug)}>
                    <Button size="sm" variant="outline" type="submit">Rechazar</Button>
                  </form>
                </div>
              ) : (
                <p className="mt-2 font-sans text-xs text-muted-foreground">
                  Solo el owner o manager pueden moderar reseñas.
                </p>
              )}
            </li>
          ))}
          {!pending.length && (
            <p className="font-sans text-sm text-muted-foreground">Nada pendiente.</p>
          )}
        </ul>
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Moderadas</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {moderated.map((r) => (
            <li
              key={r.id}
              className="rounded-md bg-muted/40 px-4 py-3 font-sans text-sm text-muted-foreground"
            >
              {"★".repeat(r.rating)} — {r.customers?.profiles?.full_name} · {r.status}
            </li>
          ))}
          {!moderated.length && (
            <p className="font-sans text-sm text-muted-foreground">Ninguna todavía.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
