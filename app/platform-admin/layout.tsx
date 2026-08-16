import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth/session";

export default async function PlatformAdminLayout({
  children,
}: LayoutProps<"/platform-admin">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/platform-admin");

  const admin = await isPlatformAdmin();
  if (!admin) redirect("/");

  return <>{children}</>;
}
