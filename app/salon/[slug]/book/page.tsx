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
  const [{ data: categories }, { data: services }, { data: variants }, { data: artists }] =
    await Promise.all([
      supabase
        .from("service_categories")
        .select("*")
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
        .select("salon_membership_id, display_name, bio")
        .eq("salon_id", salon.id)
        .eq("published", true)
        .order("sort_order"),
    ]);

  return (
    <BookingWizard
      salon={salon}
      categories={categories ?? []}
      services={services ?? []}
      variants={variants ?? []}
      artists={artists ?? []}
    />
  );
}
