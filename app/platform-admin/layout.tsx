import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth/session";

export default async function PlatformAdminLayout({
  children,
}: LayoutProps<"/platform-admin">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/platform-admin");

  const admin = await isPlatformAdmin();
  if (!admin) redirect("/");

  return (
    <div className="flex min-h-full flex-col">
      <nav className="flex items-center gap-4 border-b border-border px-8 py-4 font-sans text-sm">
        <Link href="/platform-admin/salons" className="text-foreground transition-colors hover:text-gold">
          Salones
        </Link>
        <Link href="/platform-admin/admins" className="text-foreground transition-colors hover:text-gold">
          Administradores
        </Link>
        <Link href="/" className="ml-auto text-muted-foreground transition-colors hover:text-foreground">
          Ver sitio
        </Link>
      </nav>
      {children}
    </div>
  );
}
