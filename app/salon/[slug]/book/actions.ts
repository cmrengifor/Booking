"use server";

import { DateTime } from "luxon";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeAnyArtistSlots,
  computeArtistSlots,
  computeSalonSlots,
  resolveEffectiveSlot,
} from "@/lib/domain/availability";

export async function getAvailableSlots(params: {
  salonId: string;
  locationId: string;
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
    .eq("location_id", params.locationId);

  const from = params.date;
  const to = params.date;
  // The busy-interval fetch window must be the salon's own local day, not a
  // UTC calendar day — a fixed `${date}T00:00:00Z`..`T23:59:59Z` window
  // silently excludes any appointment in the last hours before a late
  // closing time for a negative-UTC-offset salon (e.g. evening slots in
  // Bogota, UTC-5), since those instants fall on the *next* UTC day.
  const zonedDate = DateTime.fromISO(params.date, { zone: params.timezone });
  if (!zonedDate.isValid) throw new Error(`Invalid date/timezone: ${params.date} / ${params.timezone}`);
  const fromInstant = zonedDate.startOf("day").toUTC().toISO()!;
  const toInstant = zonedDate.plus({ days: 1 }).startOf("day").toUTC().toISO()!;

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

  // The full salon-hours grid — the fixed set of slot positions the time
  // picker renders regardless of who's available, so it can show the ones
  // nobody can take right now as visibly unavailable instead of just
  // omitting them.
  const allSlots = computeSalonSlots({
    date: params.date,
    timezone: params.timezone,
    salonHours: salonHours ?? [],
    slot,
  });

  if (params.artistPreference === "specific") {
    if (!params.salonMembershipId) throw new Error("Artist required.");
    const candidate = await fetchCandidate(params.salonMembershipId);
    const availableSlots = computeArtistSlots({
      date: params.date,
      timezone: params.timezone,
      salonHours: salonHours ?? [],
      ...candidate,
      slot,
    });
    return { allSlots, availableSlots };
  }

  const { data: artists } = await supabase
    .from("artist_profiles")
    .select("salon_membership_id")
    .eq("salon_id", params.salonId)
    .eq("location_id", params.locationId)
    .eq("published", true);

  const candidates = await Promise.all(
    (artists ?? []).map((a) => fetchCandidate(a.salon_membership_id))
  );

  const availableSlots = computeAnyArtistSlots(candidates, {
    date: params.date,
    timezone: params.timezone,
    salonHours: salonHours ?? [],
    slot,
  });
  return { allSlots, availableSlots };
}

/** Logged-in booking now requires a phone on file — most existing accounts
 *  (created via Google OAuth) never collected one, so the wizard prompts
 *  for it inline right before confirming instead of only in Mi cuenta. */
export async function updateMyPhone(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) throw new Error("El celular es obligatorio.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Debes iniciar sesión.");

  const { error } = await supabase.from("profiles").update({ phone: trimmed }).eq("id", user.id);
  if (error) throw new Error(error.message);
}

type HomeServiceAndPayment = {
  isHomeService: boolean;
  homeServiceAddress: string | null;
  homeServiceZoneId: string | null;
  paymentMethod: "pse" | "transferencia" | "efectivo" | null;
  paymentDetail: string | null;
};

export async function confirmBooking(
  params: {
    salonId: string;
    locationId: string;
    serviceId: string;
    variantId: string | null;
    artistPreference: "specific" | "any";
    salonMembershipId: string | null;
    startsAt: string;
    // Set when this booking started from a reagendar email link — the
    // one-time token is marked used here, only once the replacement
    // appointment actually exists, instead of when the link was merely
    // opened (see app/salon/[slug]/reagendar/[token]/page.tsx).
    rescheduleToken?: string | null;
  } & HomeServiceAndPayment
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_appointment", {
    p_salon_id: params.salonId,
    p_location_id: params.locationId,
    p_service_id: params.serviceId,
    // The DB function accepts NULL for both (any-artist bookings have no
    // variant or no named artist) — the generated RPC arg types just don't
    // reflect that nullability, so it's asserted here, not worked around.
    p_service_variant_id: params.variantId as string,
    p_artist_preference: params.artistPreference,
    p_salon_membership_id: params.salonMembershipId as string,
    p_starts_at: params.startsAt,
    p_is_home_service: params.isHomeService,
    p_home_service_address: params.homeServiceAddress as string,
    p_home_service_zone_id: params.homeServiceZoneId as string,
    p_payment_method: params.paymentMethod as string,
    p_payment_detail: params.paymentDetail as string,
  });
  if (error) throw new Error(error.message);

  if (params.rescheduleToken) {
    // appointment_action_tokens has RLS enabled with no policies at all —
    // only the service-role client can touch it. `.is("used_at", null)`
    // makes this a no-op if the token was already consumed or never
    // existed, so a stale/foreign token in the URL can't do anything
    // beyond a harmless miss.
    const admin = createAdminClient();
    await admin
      .from("appointment_action_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", params.rescheduleToken)
      .eq("purpose", "reschedule_followup")
      .is("used_at", null);
  }

  return data;
}
