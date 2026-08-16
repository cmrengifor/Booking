"use server";

import { DateTime } from "luxon";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";

async function originFromRequest() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

/** Friendly heads-up for a client with an appointment this week — manual
 *  trigger for now (an automatic <2h-before reminder needs a scheduled job,
 *  which Vercel Hobby's daily-only cron can't do; deferred). */
export async function sendUpcomingReminder(customerId: string, appointmentId: string, timezone: string) {
  const supabase = await createClient();
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, starts_at, services(name), customers(profile_id, profiles(full_name))")
    .eq("id", appointmentId)
    .eq("customer_id", customerId)
    .single();
  if (!appt) return { error: "No se encontró la cita." };

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(appt.customers!.profile_id!);
  const email = authUser?.user?.email;
  if (!email) return { error: "El cliente no tiene correo registrado." };

  const firstName = appt.customers?.profiles?.full_name?.split(" ")[0] ?? "";
  const when = DateTime.fromISO(appt.starts_at)
    .setZone(timezone)
    .setLocale("es")
    .toFormat("cccc d 'de' LLLL, HH:mm");

  await sendEmail({
    to: email,
    subject: "Recordatorio de tu cita",
    body: `Hola ${firstName},

Este es un recordatorio de tu cita de ${appt.services?.name} el ${when}.

Te esperamos — si necesitas reagendar o cancelar, contáctanos con anticipación.`,
  });

  return { error: null };
}

/** Win-back nudge for a client with no appointments in 30+ days. */
export async function sendWinBackReminder(customerId: string, slug: string) {
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, profile_id, profiles(full_name)")
    .eq("id", customerId)
    .single();
  if (!customer?.profile_id) return { error: "No se encontró el cliente." };

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(customer.profile_id);
  const email = authUser?.user?.email;
  if (!email) return { error: "El cliente no tiene correo registrado." };

  const firstName = customer.profiles?.full_name?.split(" ")[0] ?? "";
  const origin = await originFromRequest();

  await sendEmail({
    to: email,
    subject: "Te extrañamos",
    body: `Hola ${firstName},

Ha pasado un tiempo desde tu última visita y nos encantaría verte de nuevo.

Reserva tu próxima cita cuando quieras: ${origin}/salon/${slug}/book`,
  });

  return { error: null };
}
