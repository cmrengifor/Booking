import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getSalonMembership } from "@/lib/auth/session";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "", label: "Overview" },
  { href: "/appointments", label: "Citas" },
  { href: "/customers", label: "Clientes" },
  { href: "/services", label: "Servicios" },
  { href: "/staff", label: "Staff" },
  { href: "/reviews", label: "Reseñas" },
  { href: "/analytics", label: "Analytics" },
];

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
    <div className="flex flex-1 flex-col">
      <nav className="flex gap-4 border-b border-border px-8 py-4 font-sans text-sm">
        {NAV.map((item) => (
          <Link
            key={item.label}
            href={`/salon/${slug}/admin${item.href}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
        <Link
          href={`/salon/${slug}/notifications`}
          className="ml-auto text-muted-foreground hover:text-foreground"
        >
          Notificaciones{unread ? ` (${unread})` : ""}
        </Link>
      </nav>
      {children}
    </div>
  );
}
