import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getCurrentUser, getSalonMembership } from "@/lib/auth/session";
import { signOut } from "@/app/salon/[slug]/account/actions";
import { ProfileDropdown } from "@/components/kokonutui/profile-dropdown";
import type { Salon } from "@/lib/tenant/resolve-salon";

/** The header's account slot: a profile dropdown once signed in, the
 *  original plain link otherwise (account/layout.tsx sends anonymous
 *  visitors to login from there, same as before this component existed). */
export async function AccountMenu({ salon }: { salon: Salon }) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href={`/salon/${salon.slug}/account`} className="text-muted-foreground hover:text-foreground">
        Mi cuenta
      </Link>
    );
  }

  const [profile, membership] = await Promise.all([getCurrentProfile(), getSalonMembership(salon.id)]);
  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", user.id)
    .is("read_at", null);

  return (
    <ProfileDropdown
      slug={salon.slug}
      name={profile?.full_name || "Cliente"}
      email={user.email ?? ""}
      avatarUrl={profile?.avatar_url ?? null}
      unreadCount={unread ?? 0}
      isStaff={!!membership}
      onSignOut={signOut.bind(null, salon.slug)}
    />
  );
}
