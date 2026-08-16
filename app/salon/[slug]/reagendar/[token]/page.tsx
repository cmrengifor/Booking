import { notFound, redirect } from "next/navigation";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteHeader } from "@/components/public-site/site-header";
import { SiteFooter } from "@/components/public-site/site-footer";

export default async function ReagendarTokenPage({
  params,
}: PageProps<"/salon/[slug]/reagendar/[token]">) {
  const { slug, token } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) notFound();

  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from("appointment_action_tokens")
    .select("id, appointment_id, expires_at, used_at")
    .eq("id", token)
    .eq("purpose", "reschedule_followup")
    .maybeSingle();

  const valid = !!tokenRow && !tokenRow.used_at && new Date(tokenRow.expires_at) > new Date();

  if (valid) {
    const { data: appt } = await admin
      .from("appointments")
      .select("service_id, service_variant_id, salon_membership_id, artist_preference, location_id")
      .eq("id", tokenRow.appointment_id)
      .single();

    if (appt) {
      await admin
        .from("appointment_action_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenRow.id);

      const qs = new URLSearchParams();
      qs.set("serviceId", appt.service_id);
      if (appt.service_variant_id) qs.set("variantId", appt.service_variant_id);
      qs.set("locationId", appt.location_id);
      if (appt.artist_preference === "specific" && appt.salon_membership_id) {
        qs.set("preference", "specific");
        qs.set("artistId", appt.salon_membership_id);
      }
      redirect(`/salon/${slug}/book?${qs.toString()}`);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader salon={salon} />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-heading text-2xl text-foreground">Este enlace ya no está activo</h1>
        <p className="max-w-md font-sans text-sm text-muted-foreground">
          Los enlaces para reagendar están activos por 24 horas. Puedes hacer una nueva reserva
          directamente desde el sitio.
        </p>
      </div>
      <SiteFooter salon={salon} />
    </div>
  );
}
