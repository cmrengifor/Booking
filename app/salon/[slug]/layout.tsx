import { notFound } from "next/navigation";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { SalonProvider } from "@/lib/tenant/salon-context";

export default async function SalonLayout({
  children,
  params,
}: LayoutProps<"/salon/[slug]">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);

  if (!salon) notFound();

  return <SalonProvider salon={salon}>{children}</SalonProvider>;
}
