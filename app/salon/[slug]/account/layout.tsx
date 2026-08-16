import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AccountLayout({
  children,
  params,
}: LayoutProps<"/salon/[slug]/account">) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/auth/login?next=/salon/${slug}/account`);

  return <>{children}</>;
}
