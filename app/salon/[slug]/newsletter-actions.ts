"use server";

import { createClient } from "@/lib/supabase/server";

export async function subscribeToNewsletter(salonId: string, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Correo inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert({ salon_id: salonId, email }, { onConflict: "salon_id,email" });

  if (error) return { error: "No se pudo suscribir." };
  return { error: null };
}
