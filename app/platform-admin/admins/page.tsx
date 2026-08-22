import { createClient } from "@/lib/supabase/server";
import { assertNoQueryErrors } from "@/lib/supabase/assert";
import { getCurrentUser } from "@/lib/auth/session";
import { GrantAdminForm } from "./grant-admin-form";
import { RevokeAdminButton } from "./revoke-admin-button";

export default async function PlatformAdminAdminsPage() {
  const currentUser = await getCurrentUser();
  const supabase = await createClient();
  const adminsRes = await supabase
    .from("platform_admins")
    .select(
      "profile_id, granted_at, profiles!platform_admins_profile_id_fkey(full_name), granter:profiles!platform_admins_granted_by_fkey(full_name)"
    )
    .order("granted_at");
  assertNoQueryErrors([adminsRes], "Failed to load platform admins");
  const { data: admins } = adminsRes;

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Platform Admin
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">Administradores</h1>
      </div>

      <GrantAdminForm />

      <ul className="flex flex-col gap-2">
        {admins?.map((a) => (
          <li
            key={a.profile_id}
            className="flex items-center justify-between rounded-md border border-border px-4 py-3 font-sans text-sm"
          >
            <div>
              <p className="text-foreground">
                {a.profiles?.full_name ?? "Sin nombre"}
                {a.profile_id === currentUser?.id && (
                  <span className="ml-2 text-xs text-muted-foreground">(tú)</span>
                )}
              </p>
              <p className="font-sans text-xs text-muted-foreground">
                Otorgado por {a.granter?.full_name ?? "—"} ·{" "}
                {new Date(a.granted_at).toLocaleDateString("es")}
              </p>
            </div>
            <RevokeAdminButton profileId={a.profile_id} />
          </li>
        ))}
        {!admins?.length && (
          <p className="font-sans text-sm text-muted-foreground">No hay administradores.</p>
        )}
      </ul>
    </div>
  );
}
