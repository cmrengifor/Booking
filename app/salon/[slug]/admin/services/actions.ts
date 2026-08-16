"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Every mutation here runs through the caller's own RLS-scoped session —
// if they aren't owner/manager of this salon, the write is rejected at the
// database level regardless of what this action attempts.

export async function createCategory(salonId: string, slug: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  await supabase.from("service_categories").insert({ salon_id: salonId, name });

  revalidatePath(`/salon/${slug}/admin/services`);
}

export async function createService(salonId: string, slug: string, formData: FormData) {
  const categoryId = String(formData.get("category_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const price = Number(formData.get("base_price"));
  const duration = Number(formData.get("base_duration_minutes"));
  const buffer = Number(formData.get("buffer_minutes") ?? 0);

  if (!categoryId || !name || !price || !duration) return;

  const supabase = await createClient();
  await supabase.from("services").insert({
    salon_id: salonId,
    category_id: categoryId,
    name,
    description,
    has_variants: false,
    base_price: price,
    base_duration_minutes: duration,
    buffer_minutes: buffer,
  });

  revalidatePath(`/salon/${slug}/admin/services`);
}

export async function toggleServiceActive(serviceId: string, active: boolean, slug: string) {
  const supabase = await createClient();
  await supabase.from("services").update({ active: !active }).eq("id", serviceId);
  revalidatePath(`/salon/${slug}/admin/services`);
}
