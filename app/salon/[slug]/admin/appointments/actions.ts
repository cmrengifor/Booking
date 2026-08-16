"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";

async function callRpc(
  slug: string,
  name:
    | "accept_open_appointment"
    | "accept_pending_appointment"
    | "decline_pending_appointment"
    | "release_appointment"
    | "cancel_appointment"
    | "complete_appointment"
    | "mark_no_show",
  args: Record<string, unknown>
) {
  const supabase = await createClient();
  // @ts-expect-error -- name is a union of literal RPC names, args shape varies per function
  const { error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  revalidatePath(`/salon/${slug}/admin/appointments`);
}

export const takeOpenAppointment = async (
  appointmentId: string,
  assignToMembershipId: string | null,
  slug: string
) =>
  callRpc(slug, "accept_open_appointment", {
    p_appointment_id: appointmentId,
    p_assign_to_membership_id: assignToMembershipId,
  });

export const acceptPending = async (appointmentId: string, slug: string) =>
  callRpc(slug, "accept_pending_appointment", { p_appointment_id: appointmentId });

const DECLINE_REASON_TEXT: Record<string, string> = {
  artist_unavailable: "El artista no está disponible en ese horario.",
  time_conflict: "El horario solicitado ya no está disponible.",
};

/** Declining a pending request also explains why, by email — staff picks a
 *  short reason (or writes one) in the UI, which both gets stored as the
 *  appointment's cancellation_reason and used to word the email. */
export async function declinePending(appointmentId: string, slug: string, formData: FormData) {
  const reasonCode = String(formData.get("reason") ?? "artist_unavailable");
  const customReason = String(formData.get("custom_reason") ?? "").trim();
  const reasonText =
    reasonCode === "other" ? customReason || "No fue posible confirmar tu cita." : DECLINE_REASON_TEXT[reasonCode];
  const storedReason = reasonCode === "other" ? customReason || "other" : reasonCode;

  const supabase = await createClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, services(name), customers(profile_id, profiles(full_name))")
    .eq("id", appointmentId)
    .single();

  const { error } = await supabase.rpc("decline_pending_appointment", {
    p_appointment_id: appointmentId,
    p_reason: storedReason,
  });
  if (error) throw new Error(error.message);

  if (appt?.customers?.profile_id) {
    const admin = createAdminClient();
    const { data: authUser } = await admin.auth.admin.getUserById(appt.customers.profile_id);
    const email = authUser?.user?.email;
    const firstName = appt.customers?.profiles?.full_name?.split(" ")[0] ?? "";
    if (email) {
      await sendEmail({
        to: email,
        subject: "No pudimos confirmar tu cita",
        body: `Hola ${firstName},

Lamentamos informarte que no pudimos confirmar tu solicitud de cita${appt.services?.name ? ` para ${appt.services.name}` : ""}.

Motivo: ${reasonText}

Puedes hacer una nueva reserva desde el sitio cuando quieras — lo sentimos por el inconveniente.`,
      });
    }
  }

  revalidatePath(`/salon/${slug}/admin/appointments`);
}

export const release = async (appointmentId: string, slug: string) =>
  callRpc(slug, "release_appointment", { p_appointment_id: appointmentId, p_reason: null });

export const staffCancel = async (appointmentId: string, slug: string) =>
  callRpc(slug, "cancel_appointment", { p_appointment_id: appointmentId, p_reason: "cancelled by staff" });

export const complete = async (appointmentId: string, amountPaid: number, slug: string) =>
  callRpc(slug, "complete_appointment", { p_appointment_id: appointmentId, p_amount_paid: amountPaid });

export const noShow = async (appointmentId: string, slug: string) =>
  callRpc(slug, "mark_no_show", { p_appointment_id: appointmentId });

async function originFromRequest() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

/** Cancelled appointment -> empathetic email with a 24h reschedule link.
 *  Reschedule goes through a fresh booking (prefilled), not reopening the
 *  cancelled row — appointments are terminal by design once cancelled. */
export async function triggerRescheduleFollowup(appointmentId: string, slug: string) {
  const supabase = await createClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select(
      "id, salon_id, location_id, service_id, service_variant_id, salon_membership_id, artist_preference, services(name), customers(profile_id, profiles(full_name))"
    )
    .eq("id", appointmentId)
    .single();
  if (!appt) throw new Error("Appointment not found.");

  const admin = createAdminClient();
  const { data: token, error: tokenError } = await admin
    .from("appointment_action_tokens")
    .insert({
      appointment_id: appt.id,
      salon_id: appt.salon_id,
      purpose: "reschedule_followup",
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (tokenError || !token) throw new Error(tokenError?.message ?? "Could not create follow-up link.");

  const { data: authUser } = await admin.auth.admin.getUserById(appt.customers!.profile_id);
  const email = authUser?.user?.email;
  if (!email) throw new Error("Customer has no email on file.");

  const origin = await originFromRequest();
  const link = `${origin}/salon/${slug}/reagendar/${token.id}`;
  const firstName = appt.customers?.profiles?.full_name?.split(" ")[0] ?? "";

  await sendEmail({
    to: email,
    subject: "¿Reagendamos tu cita?",
    body: `Hola ${firstName},

Entendemos que el tráfico en la ciudad es complicado — sabemos que a veces las cosas no salen como se planean. Notamos que tu cita de ${appt.services?.name} se canceló, y nos encantaría verte pronto.

Si quieres reagendar, sigue este enlace: ${link}

Este enlace estará activo por 24 horas. Pasado ese tiempo, no podrás usarlo para reagendar y tendrás que hacer una nueva reserva desde el sitio.`,
  });

  revalidatePath(`/salon/${slug}/admin/appointments`);
  // Returned so the admin UI can show the link directly — there's no real
  // inbox to check yet since email sending is still stubbed.
  return { link };
}

/** Completed appointment -> NPS + review survey email, token-gated so the
 *  customer can respond without necessarily being logged in. */
export async function triggerNpsSurvey(appointmentId: string, slug: string) {
  const supabase = await createClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, salon_id, services(name), customers(profile_id, profiles(full_name))")
    .eq("id", appointmentId)
    .single();
  if (!appt) throw new Error("Appointment not found.");

  const admin = createAdminClient();
  const { data: token, error: tokenError } = await admin
    .from("appointment_action_tokens")
    .insert({
      appointment_id: appt.id,
      salon_id: appt.salon_id,
      purpose: "nps_survey",
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (tokenError || !token) throw new Error(tokenError?.message ?? "Could not create survey link.");

  const { data: authUser } = await admin.auth.admin.getUserById(appt.customers!.profile_id);
  const email = authUser?.user?.email;
  if (!email) throw new Error("Customer has no email on file.");

  const origin = await originFromRequest();
  const link = `${origin}/salon/${slug}/encuesta/${token.id}`;
  const firstName = appt.customers?.profiles?.full_name?.split(" ")[0] ?? "";

  await sendEmail({
    to: email,
    subject: "Gracias por tu visita",
    body: `Hola ${firstName},

Gracias por elegirnos y por confiar en nosotras para tu ${appt.services?.name}. Nos encantaría saber cómo fue tu experiencia.

Cuéntanos en menos de un minuto: ${link}

Y si tienes un momento más, nos ayudaría muchísimo que dejaras tu reseña — se puede hacer desde el mismo enlace.`,
  });

  revalidatePath(`/salon/${slug}/admin/appointments`);
  return { link };
}
