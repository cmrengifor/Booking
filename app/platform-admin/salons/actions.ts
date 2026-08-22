"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Every mutation here runs through the caller's own RLS-scoped session —
// salons_insert/salons_update already restrict this to platform admins at
// the database level (see migration 20260816004427_rls_helpers_and_policies_phase1).

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function createSalon(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const timezone = String(formData.get("timezone") ?? "").trim();

  if (!name) return { error: "El nombre no puede estar vacío." };
  if (!SLUG_PATTERN.test(slug)) {
    return { error: "El slug solo puede tener minúsculas, números y guiones (ej. mi-salon)." };
  }
  if (!timezone || !Intl.supportedValuesOf("timeZone").includes(timezone)) {
    return { error: "Zona horaria inválida — usa el formato IANA (ej. America/Bogota)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("salons").insert({ name, slug, timezone });

  if (error) {
    if (error.code === "23505") return { error: "Ese slug ya está en uso." };
    return { error: error.message };
  }

  revalidatePath("/platform-admin/salons");
  return { error: null };
}

export async function setSalonStatus(salonId: string, status: "active" | "suspended") {
  const supabase = await createClient();
  const { error } = await supabase.from("salons").update({ status }).eq("id", salonId);
  if (error) throw new Error(error.message);
  revalidatePath("/platform-admin/salons");
}
