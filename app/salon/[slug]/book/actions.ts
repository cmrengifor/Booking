"use server";

import { createClient } from "@/lib/supabase/server";
import {
  computeAnyArtistSlots,
  computeArtistSlots,
  resolveEffectiveSlot,
} from "@/lib/domain/availability";

export async function getAvailableSlots(params: {
  salonId: string;
  timezone: string;
  serviceId: string;
  variantId: string | null;
  artistPreference: "specific" | "any";
  salonMembershipId: string | null;
  date: string;
}) {
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("id", params.serviceId)
    .single();
  if (!service) throw new Error("Service not found.");

  let variant = null;
  if (params.variantId) {
    const { data } = await supabase
      .from("service_variants")
      .select("*")
      .eq("id", params.variantId)
      .single();
    variant = data;
  }
  const slot = resolveEffectiveSlot(service, variant);

  const { data: salonHours } = await supabase
    .from("salon_weekly_hours")
    .select("day_of_week, open_time, close_time")
    .eq("salon_id", params.salonId);

  const from = params.date;
  const to = params.date;
  const fromInstant = `${params.date}T00:00:00Z`;
  const toInstant = `${params.date}T23:59:59Z`;

  async function fetchCandidate(membershipId: string) {
    const [{ data: artistHours }, { data: timeOff }, { data: busy }] =
      await Promise.all([
        supabase.rpc("get_public_artist_weekly_hours", {
          p_salon_membership_id: membershipId,
        }),
        supabase.rpc("get_public_artist_time_off", {
          p_salon_membership_id: membershipId,
          p_from: from,
          p_to: to,
        }),
        supabase.rpc("get_public_busy_intervals", {
          p_salon_membership_id: membershipId,
          p_from: fromInstant,
          p_to: toInstant,
        }),
      ]);
    return {
      artistHours: artistHours ?? [],
      timeOff: timeOff ?? [],
      busy: busy ?? [],
    };
  }

  if (params.artistPreference === "specific") {
    if (!params.salonMembershipId) throw new Error("Artist required.");
    const candidate = await fetchCandidate(params.salonMembershipId);
    return computeArtistSlots({
      date: params.date,
      timezone: params.timezone,
      salonHours: salonHours ?? [],
      ...candidate,
      slot,
    });
  }

  const { data: artists } = await supabase
    .from("artist_profiles")
    .select("salon_membership_id")
    .eq("salon_id", params.salonId)
    .eq("published", true);

  const candidates = await Promise.all(
    (artists ?? []).map((a) => fetchCandidate(a.salon_membership_id))
  );

  return computeAnyArtistSlots(candidates, {
    date: params.date,
    timezone: params.timezone,
    salonHours: salonHours ?? [],
    slot,
  });
}

export async function confirmBooking(params: {
  salonId: string;
  serviceId: string;
  variantId: string | null;
  artistPreference: "specific" | "any";
  salonMembershipId: string | null;
  startsAt: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_appointment", {
    p_salon_id: params.salonId,
    p_service_id: params.serviceId,
    // The DB function accepts NULL for both (any-artist bookings have no
    // variant or no named artist) — the generated RPC arg types just don't
    // reflect that nullability, so it's asserted here, not worked around.
    p_service_variant_id: params.variantId as string,
    p_artist_preference: params.artistPreference,
    p_salon_membership_id: params.salonMembershipId as string,
    p_starts_at: params.startsAt,
  });
  if (error) throw new Error(error.message);
  return data;
}
