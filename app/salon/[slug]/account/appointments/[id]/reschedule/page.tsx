import { notFound } from "next/navigation";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";
import { RescheduleForm } from "./reschedule-form";

export default async function ReschedulePage({
  params,
}: PageProps<"/salon/[slug]/account/appointments/[id]/reschedule">) {
  const { slug, id } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) notFound();

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, status, starts_at, service_id, service_variant_id, artist_preference, salon_membership_id, services(name), service_variants(name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!appointment) notFound();

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Reagendar
        </p>
        <h1 className="mt-2 font-heading text-2xl text-foreground">
          {appointment.services?.name}
          {appointment.service_variants?.name && ` — ${appointment.service_variants.name}`}
        </h1>
      </div>
      <RescheduleForm
        salon={salon}
        appointment={appointment}
      />
    </div>
  );
}
