import { notFound } from "next/navigation";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";
import { BookingWizard } from "./booking-wizard";

export default async function BookPage({
  params,
}: PageProps<"/salon/[slug]/book">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) notFound();

  const supabase = await createClient();
  const [{ data: locations }, { data: services }, { data: variants }, { data: artists }, { data: homeServiceZones }] =
    await Promise.all([
      supabase
        .from("salon_locations")
        .select("id, name, address")
        .eq("salon_id", salon.id)
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("services")
        .select("*")
        .eq("salon_id", salon.id)
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("service_variants")
        .select("*")
        .eq("salon_id", salon.id)
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("artist_profiles")
        .select("salon_membership_id, display_name, bio, location_id, headshot_url")
        .eq("salon_id", salon.id)
        .eq("published", true)
        .order("sort_order"),
      supabase
        .from("home_service_zones")
        .select("id, name, surcharge")
        .eq("salon_id", salon.id)
        .eq("active", true)
        .order("sort_order"),
    ]);

  return (
    <BookingWizard
      salon={salon}
      locations={locations ?? []}
      services={services ?? []}
      variants={variants ?? []}
      artists={artists ?? []}
      homeServiceZones={homeServiceZones ?? []}
    />
  );
}
