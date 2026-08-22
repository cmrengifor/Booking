"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function subscribeToNewsletter(salonId: string, formData: FormData) {
  if (!(await checkRateLimit("newsletter", 5, 3600))) {
    return { error: "Demasiados intentos — intenta de nuevo más tarde." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Correo inválido." };
  }

  const supabase = await createClient();
  // Plain insert, not upsert: an ON CONFLICT DO UPDATE/DO NOTHING clause
  // needs to detect the existing row, which under RLS goes through the
  // SELECT policy (staff-only here) regardless of what INSERT/UPDATE allow
  // — so anon can never satisfy it. A 23505 (unique_violation) on
  // (salon_id, email) just means already subscribed; treat it as success.
  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({ salon_id: salonId, email });

  if (error && error.code !== "23505") return { error: "No se pudo suscribir." };
  return { error: null };
}
