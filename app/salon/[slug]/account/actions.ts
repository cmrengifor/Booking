"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { presetAvatarUrl } from "@/lib/avatars";

export async function updateAvatar(slug: string, formData: FormData) {
  const avatarId = Number(formData.get("avatar_id"));
  // Resolve against the server's own catalog rather than trusting a URL
  // from the client — avatar_url ends up rendered site-wide via next/image.
  const avatarUrl = presetAvatarUrl(avatarId);
  if (!avatarUrl) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);

  revalidatePath(`/salon/${slug}/account`);
}

export async function updateProfile(slug: string, formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ full_name: fullName || null, phone: phone || null })
    .eq("id", user.id);

  revalidatePath(`/salon/${slug}/account`);
}

export async function cancelMyAppointment(appointmentId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_appointment", {
    p_appointment_id: appointmentId,
    p_reason: "cancelled by customer",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/salon/${slug}/account`);
}

export async function submitReview(appointmentId: string, slug: string, formData: FormData) {
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", {
    p_appointment_id: appointmentId,
    p_rating: rating,
    // The DB function accepts NULL for an empty comment — see the same
    // generated-type nullability note in book/actions.ts.
    p_comment: comment as string,
  });
  // A duplicate review isn't a real error from the customer's point of
  // view (e.g. a reload after already submitting) — treat it as success.
  if (error && error.code !== "23505") throw new Error(error.message);

  revalidatePath(`/salon/${slug}/account`);
}

export async function signOut(slug: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/salon/${slug}`);
}
