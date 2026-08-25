import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getCurrentUser, getSalonMembership, isPlatformAdmin } from "@/lib/auth/session";
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

  const [profile, membership, platformAdmin] = await Promise.all([
    getCurrentProfile(),
    getSalonMembership(salon.id),
    isPlatformAdmin(),
  ]);
  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", user.id)
    .is("read_at", null);

  // The customer's one persistent thread with this salon, if they've ever
  // started it — unread here means a staff message since they last opened
  // the drawer, mirroring notifications' own read_at pattern.
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, customer_last_read_at, customers!inner(profile_id)")
    .eq("salon_id", salon.id)
    .eq("customers.profile_id", user.id)
    .maybeSingle();

  let unreadMessages = 0;
  if (conversation) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .eq("sender_role", "staff")
      .gt("created_at", conversation.customer_last_read_at ?? "1970-01-01");
    unreadMessages = count ?? 0;
  }

  return (
    <ProfileDropdown
      slug={salon.slug}
      name={profile?.full_name || "Cliente"}
      email={user.email ?? ""}
      avatarUrl={profile?.avatar_url ?? null}
      unreadCount={unread ?? 0}
      unreadMessages={unreadMessages}
      isStaff={!!membership}
      isPlatformAdmin={platformAdmin}
      onSignOut={signOut.bind(null, salon.slug)}
    />
  );
}
