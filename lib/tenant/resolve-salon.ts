import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Salon = Tables<"salons">;

/**
 * Resolves a salon by slug once per request. Deliberately does not filter by
 * status here — RLS is the security boundary (public visitors only ever get
 * `active` rows back; staff of a suspended salon can still resolve their own
 * salon to preview/manage it). A null result means "not visible to this
 * requester," which the caller turns into a 404 either way.
 */
export const resolveSalonBySlug = cache(
  async (slug: string): Promise<Salon | null> => {
    const supabase = await createClient();
    const { data: salon } = await supabase
      .from("salons")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    return salon;
  }
);
