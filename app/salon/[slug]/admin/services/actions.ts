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
  const { error } = await supabase.from("service_categories").insert({ salon_id: salonId, name });
  if (error) throw new Error(error.message);

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
  const { error } = await supabase.from("services").insert({
    salon_id: salonId,
    category_id: categoryId,
    name,
    description,
    has_variants: false,
    base_price: price,
    base_duration_minutes: duration,
    buffer_minutes: buffer,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/salon/${slug}/admin/services`);
}

export async function toggleServiceActive(serviceId: string, active: boolean, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("services").update({ active: !active }).eq("id", serviceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/salon/${slug}/admin/services`);
}

export async function toggleCategoryActive(categoryId: string, active: boolean, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_categories")
    .update({ active: !active })
    .eq("id", categoryId);
  if (error) throw new Error(error.message);
  revalidatePath(`/salon/${slug}/admin/services`);
}

export async function updateServiceSplit(serviceId: string, splitPercent: number, slug: string) {
  if (!Number.isInteger(splitPercent) || splitPercent < 0 || splitPercent > 100) {
    return { error: "El split debe ser un número entero entre 0 y 100." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ artist_split_percent: splitPercent })
    .eq("id", serviceId);
  if (error) return { error: error.message };
  revalidatePath(`/salon/${slug}/admin/services`);
  return { error: null };
}

/** Hard-deletes when there's no history referencing this row; a service
 *  with any appointment (any status, ever) hits `on delete restrict` on
 *  appointments.service_id, so we fall back to archiving it instead. */
export async function deleteService(serviceId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", serviceId);
  if (error) {
    if (error.code === "23503") {
      const { error: archiveError } = await supabase
        .from("services")
        .update({ active: false })
        .eq("id", serviceId);
      if (archiveError) return { error: archiveError.message, archived: false };
      revalidatePath(`/salon/${slug}/admin/services`);
      return { error: null, archived: true };
    }
    return { error: error.message, archived: false };
  }
  revalidatePath(`/salon/${slug}/admin/services`);
  return { error: null, archived: false };
}

export async function createPromotion(
  serviceId: string,
  salonId: string,
  slug: string,
  formData: FormData
) {
  const discountPercent = Number(formData.get("discount_percent"));
  const startsAt = String(formData.get("starts_at") ?? "");
  const endsAt = String(formData.get("ends_at") ?? "");

  if (!discountPercent || !startsAt || !endsAt) {
    return { error: "Completa el descuento y las fechas de inicio y fin." };
  }
  if (new Date(endsAt) <= new Date(startsAt)) {
    return { error: "La fecha de fin debe ser posterior a la de inicio." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("service_promotions").insert({
    service_id: serviceId,
    salon_id: salonId,
    discount_percent: discountPercent,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/salon/${slug}/admin/services`);
  return { error: null };
}

export async function deletePromotion(promotionId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("service_promotions").delete().eq("id", promotionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/salon/${slug}/admin/services`);
}

/** Same fallback as deleteService: a category with any service (active or
 *  archived) hits `on delete restrict` on services.category_id. */
export async function deleteCategory(categoryId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("service_categories").delete().eq("id", categoryId);
  if (error) {
    if (error.code === "23503") {
      const { error: archiveError } = await supabase
        .from("service_categories")
        .update({ active: false })
        .eq("id", categoryId);
      if (archiveError) return { error: archiveError.message, archived: false };
      revalidatePath(`/salon/${slug}/admin/services`);
      return { error: null, archived: true };
    }
    return { error: error.message, archived: false };
  }
  revalidatePath(`/salon/${slug}/admin/services`);
  return { error: null, archived: false };
}
