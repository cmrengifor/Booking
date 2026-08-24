import { Toaster } from "sonner";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getSalonMembership } from "@/lib/auth/session";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./admin-sidebar";

export default async function AdminLayout({
  children,
  params,
}: LayoutProps<"/salon/[slug]/admin">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/auth/login?next=/salon/${slug}/admin`);

  const membership = await getSalonMembership(salon.id);
  if (!membership) redirect(`/salon/${slug}`);

  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", user.id)
    .is("read_at", null);

  return (
    <SidebarProvider className="min-h-0 flex-1">
      <Toaster position="top-right" richColors />
      <AdminSidebar slug={slug} salonName={salon.name} unread={unread ?? 0} userId={user.id} />
      <SidebarInset>
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
