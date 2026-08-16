"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

export const declinePending = async (appointmentId: string, slug: string) =>
  callRpc(slug, "decline_pending_appointment", { p_appointment_id: appointmentId });

export const release = async (appointmentId: string, slug: string) =>
  callRpc(slug, "release_appointment", { p_appointment_id: appointmentId, p_reason: null });

export const staffCancel = async (appointmentId: string, slug: string) =>
  callRpc(slug, "cancel_appointment", { p_appointment_id: appointmentId, p_reason: "cancelled by staff" });

export const complete = async (appointmentId: string, amountPaid: number, slug: string) =>
  callRpc(slug, "complete_appointment", { p_appointment_id: appointmentId, p_amount_paid: amountPaid });

export const noShow = async (appointmentId: string, slug: string) =>
  callRpc(slug, "mark_no_show", { p_appointment_id: appointmentId });
