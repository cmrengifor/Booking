"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";

// platform_admins_write RLS already restricts insert/delete here to
// existing platform admins (see migration 20260816004427_rls_helpers_and_policies_phase1);
// the last-remaining-admin floor is enforced by a DB trigger, not here
// (see migration 20260828020000_platform_admin_min_one).

/** Supabase's admin API has no getUserByEmail — only paginated listUsers —
 *  so granting access means scanning pages until a match turns up. Fine at
 *  this app's scale; would need revisiting if the user base grows large. */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const target = email.trim().toLowerCase();

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function grantPlatformAdmin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Ingresa un correo." };

  const userId = await findUserIdByEmail(email);
  if (!userId) return { error: "No existe una cuenta con ese correo." };

  const currentUser = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_admins")
    .insert({ profile_id: userId, granted_by: currentUser?.id ?? null });

  if (error) {
    if (error.code === "23505") return { error: "Esa persona ya es platform admin." };
    return { error: error.message };
  }

  revalidatePath("/platform-admin/admins");
  return { error: null };
}

export async function revokePlatformAdmin(profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("platform_admins").delete().eq("profile_id", profileId);
  if (error) return { error: error.message };

  revalidatePath("/platform-admin/admins");
  return { error: null };
}
