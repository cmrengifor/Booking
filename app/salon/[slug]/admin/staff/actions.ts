"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send-email";
import { originFromRequest } from "@/lib/http";
import type { Enums } from "@/types/database";

// Every mutation here runs through the caller's own RLS-scoped session —
// staff_weekly_hours/staff_time_off/artist_profiles writes are restricted
// to owner/manager at the RLS level (see migration 20260816005958,
// decision H.10 — not self-service by the artist). salon_memberships writes
// additionally can't touch a row currently holding role='owner' unless the
// caller is an owner themselves, and role itself can only change through
// the update_staff_role RPC — see migration 20260828000000 for why.

const INVITE_ROLE_LABEL: Record<string, string> = {
  owner: "Dueño/a",
  manager: "Manager",
  receptionist: "Recepción",
  stylist: "Artista",
};

export async function inviteStaffMember(
  salonId: string,
  salonName: string,
  slug: string,
  formData: FormData
) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Enums<"salon_role">;
  const locationId = String(formData.get("location_id") ?? "") || null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Ingresa un correo válido." };
  if (!["owner", "manager", "receptionist", "stylist"].includes(role)) {
    return { error: "Rol inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("salon_memberships").insert({
    salon_id: salonId,
    invited_email: email,
    role,
    location_id: locationId,
    status: "invited",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe una invitación pendiente para este correo en este salón." };
    }
    if (error.code === "42501") return { error: "Solo un owner puede invitar a otro owner." };
    return { error: error.message };
  }

  const origin = await originFromRequest();
  const next = encodeURIComponent(`/salon/${slug}/admin`);
  await sendEmail({
    to: email,
    subject: `Te invitaron a unirte a ${salonName}`,
    body: `Hola,

Te invitaron a unirte al equipo de ${salonName} como ${INVITE_ROLE_LABEL[role] ?? role}.

Para activar tu acceso, inicia sesión (o crea una cuenta si todavía no tienes una) usando este mismo correo: ${origin}/auth/login?next=${next}

Si no esperabas esta invitación, puedes ignorar este mensaje.`,
  });

  revalidatePath(`/salon/${slug}/admin/staff`);
  return { error: null };
}

export async function cancelStaffInvite(membershipId: string, slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salon_memberships")
    .delete()
    .eq("id", membershipId)
    .eq("status", "invited")
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Solo un owner puede cancelar una invitación de owner." };

  revalidatePath(`/salon/${slug}/admin/staff`);
  return { error: null };
}

export async function updateStaffRole(membershipId: string, role: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_staff_role", {
    p_membership_id: membershipId,
    p_new_role: role as Enums<"salon_role">,
  });
  if (error) return { error: error.message };

  revalidatePath(`/salon/${slug}/admin/staff`);
  return { error: null };
}

export async function reassignStaffLocation(
  membershipId: string,
  locationId: string | null,
  slug: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salon_memberships")
    .update({ location_id: locationId })
    .eq("id", membershipId)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Solo un owner puede reasignar la sede de otro owner." };

  revalidatePath(`/salon/${slug}/admin/staff`);
  return { error: null };
}

export async function updateStaffProfile(
  membershipId: string,
  slug: string,
  formData: FormData
) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim() || null;
  if (!displayName) return { error: "El nombre no puede estar vacío." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("artist_profiles")
    .update({ display_name: displayName, bio })
    .eq("salon_membership_id", membershipId);
  if (error) return { error: error.message };

  revalidatePath(`/salon/${slug}/admin/staff`);
  return { error: null };
}

type DaySchedule = {
  dayOfWeek: number;
  off: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
};

export async function updateStaffSchedule(
  membershipId: string,
  salonId: string,
  slug: string,
  days: DaySchedule[]
) {
  const supabase = await createClient();

  for (const day of days) {
    if (day.off) {
      const { error } = await supabase
        .from("staff_weekly_hours")
        .delete()
        .eq("salon_membership_id", membershipId)
        .eq("day_of_week", day.dayOfWeek);
      if (error) return { error: error.message };
      continue;
    }
    if (!day.startTime || !day.endTime) continue;
    const { error } = await supabase.from("staff_weekly_hours").upsert(
      {
        salon_membership_id: membershipId,
        salon_id: salonId,
        day_of_week: day.dayOfWeek,
        start_time: day.startTime,
        end_time: day.endTime,
        break_start: day.breakStart || null,
        break_end: day.breakEnd || null,
      },
      { onConflict: "salon_membership_id,day_of_week" }
    );
    if (error) return { error: error.message };
  }

  revalidatePath(`/salon/${slug}/admin/staff`);
  return { error: null };
}

export async function addTimeOff(
  membershipId: string,
  salonId: string,
  slug: string,
  formData: FormData
) {
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!startDate || !endDate) return { error: "Completa las fechas de inicio y fin." };
  if (endDate < startDate) return { error: "La fecha de fin debe ser posterior a la de inicio." };

  const supabase = await createClient();
  const { error } = await supabase.from("staff_time_off").insert({
    salon_membership_id: membershipId,
    salon_id: salonId,
    start_date: startDate,
    end_date: endDate,
    reason,
  });
  if (error) return { error: error.message };

  revalidatePath(`/salon/${slug}/admin/staff`);
  return { error: null };
}

export async function removeTimeOff(timeOffId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("staff_time_off").delete().eq("id", timeOffId);
  if (error) throw new Error(error.message);
  revalidatePath(`/salon/${slug}/admin/staff`);
}

/** Hard-deletes when there's no history; a member with any appointment
 *  (any status, ever) hits `on delete restrict` on
 *  appointments.salon_membership_id, so we fall back to disabling instead
 *  — which also happens to be the semaphore's "red" state. */
export async function deleteStaffMember(membershipId: string, slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salon_memberships")
    .delete()
    .eq("id", membershipId)
    .select("id");
  if (error) {
    if (error.code === "23503") {
      const { data: disableData, error: disableError } = await supabase
        .from("salon_memberships")
        .update({ status: "disabled" })
        .eq("id", membershipId)
        .select("id");
      if (disableError) return { error: disableError.message, archived: false };
      if (!disableData?.length) {
        return { error: "Solo un owner puede deshabilitar a otro owner.", archived: false };
      }
      revalidatePath(`/salon/${slug}/admin/staff`);
      return { error: null, archived: true };
    }
    return { error: error.message, archived: false };
  }
  if (!data?.length) return { error: "Solo un owner puede eliminar a otro owner.", archived: false };
  revalidatePath(`/salon/${slug}/admin/staff`);
  return { error: null, archived: false };
}

export async function reactivateStaffMember(membershipId: string, slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salon_memberships")
    .update({ status: "active" })
    .eq("id", membershipId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Solo un owner puede reactivar a otro owner.");
  revalidatePath(`/salon/${slug}/admin/staff`);
}
