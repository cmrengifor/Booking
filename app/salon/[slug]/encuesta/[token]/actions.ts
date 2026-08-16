"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function submitSurvey(token: string, formData: FormData) {
  const score = Number(formData.get("score"));
  const ratingRaw = formData.get("rating");
  const rating = ratingRaw ? Number(ratingRaw) : null;
  const comment = String(formData.get("comment") ?? "").trim() || null;

  if (!Number.isInteger(score) || score < 0 || score > 10) {
    return { error: "Elige un puntaje entre 0 y 10." };
  }

  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from("appointment_action_tokens")
    .select("id, appointment_id, used_at, expires_at")
    .eq("id", token)
    .eq("purpose", "nps_survey")
    .maybeSingle();

  if (!tokenRow || (tokenRow.used_at ? false : new Date(tokenRow.expires_at) < new Date())) {
    return { error: "Este enlace ya no está activo." };
  }

  const { data: appt } = await admin
    .from("appointments")
    .select("id, salon_id, customer_id, service_id, salon_membership_id, status")
    .eq("id", tokenRow.appointment_id)
    .single();
  if (!appt || appt.status !== "completed") {
    return { error: "No pudimos encontrar esta cita." };
  }

  const { error: npsError } = await admin.from("nps_responses").insert({
    salon_id: appt.salon_id,
    appointment_id: appt.id,
    customer_id: appt.customer_id,
    score,
  });
  // A repeat submission (already answered) isn't a real error from the
  // customer's point of view — same "treat as success" pattern as reviews.
  if (npsError && npsError.code !== "23505") {
    return { error: "No se pudo guardar tu respuesta." };
  }

  if (rating && appt.salon_membership_id) {
    const { error: reviewError } = await admin.from("reviews").insert({
      salon_id: appt.salon_id,
      appointment_id: appt.id,
      customer_id: appt.customer_id,
      salon_membership_id: appt.salon_membership_id,
      service_id: appt.service_id,
      rating,
      comment,
      status: "pending",
    });
    // Non-fatal: the NPS score is the primary thing being captured here.
    if (reviewError && reviewError.code !== "23505") {
      console.error("survey review insert failed", reviewError);
    }
  }

  if (!tokenRow.used_at) {
    await admin
      .from("appointment_action_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);
  }

  return { error: null };
}
