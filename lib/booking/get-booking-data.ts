import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type BookingLocation = { id: string; name: string; address: string | null };
export type BookingArtist = {
  salon_membership_id: string;
  display_name: string;
  bio: string | null;
  location_id: string | null;
  headshot_url: string | null;
};
export type BookingHomeServiceZone = { id: string; name: string; surcharge: number };

export type BookingData = {
  locations: BookingLocation[];
  services: Tables<"services">[];
  variants: Tables<"service_variants">[];
  artists: BookingArtist[];
  homeServiceZones: BookingHomeServiceZone[];
};

/**
 * Everything the booking drawer needs, wherever it's mounted. `cache()`
 * dedupes this to one round-trip per request — the salon layout (for the
 * always-mounted global drawer) and /book's own page (the deep-link route)
 * both call this for the same salon within the same request.
 */
export const getBookingData = cache(async (salonId: string): Promise<BookingData> => {
  const supabase = await createClient();
  const [{ data: locations }, { data: services }, { data: variants }, { data: artists }, { data: homeServiceZones }] =
    await Promise.all([
      supabase
        .from("salon_locations")
        .select("id, name, address")
        .eq("salon_id", salonId)
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("services")
        .select("*")
        .eq("salon_id", salonId)
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("service_variants")
        .select("*")
        .eq("salon_id", salonId)
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("artist_profiles")
        .select("salon_membership_id, display_name, bio, location_id, headshot_url")
        .eq("salon_id", salonId)
        .eq("published", true)
        .order("sort_order"),
      supabase
        .from("home_service_zones")
        .select("id, name, surcharge")
        .eq("salon_id", salonId)
        .eq("active", true)
        .order("sort_order"),
    ]);

  return {
    locations: locations ?? [],
    services: services ?? [],
    variants: variants ?? [],
    artists: artists ?? [],
    homeServiceZones: homeServiceZones ?? [],
  };
});
