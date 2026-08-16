"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitReschedule(
  appointmentId: string,
  slug: string,
  newStartsAt: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_appointment", {
    p_appointment_id: appointmentId,
    p_new_starts_at: newStartsAt,
    p_new_salon_membership_id: null as unknown as string,
  });
  if (error) throw new Error(error.message);
  redirect(`/salon/${slug}/account`);
}
