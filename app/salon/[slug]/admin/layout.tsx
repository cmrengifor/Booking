import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getSalonMembership } from "@/lib/auth/session";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";

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

  return <>{children}</>;
}
