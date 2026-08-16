import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * `auth.getUser()` is a real round-trip to Supabase's auth server (it
 * re-verifies the JWT server-side, unlike a local decode), and layout +
 * page both call into these helpers for the same request — without this
 * `cache()`, every route paid for it twice. Wrapping here dedupes it to
 * one call per request, same pattern as `resolveSalonBySlug`.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
});

/** Active membership + role for the current user at one salon, or null. */
export const getSalonMembership = cache(async (salonId: string) => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("salon_memberships")
    .select("*")
    .eq("salon_id", salonId)
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  return data;
});

export const isPlatformAdmin = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_admins")
    .select("profile_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  return !!data;
});
