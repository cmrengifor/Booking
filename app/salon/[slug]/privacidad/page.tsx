import { notFound } from "next/navigation";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getSalonMembership, isPlatformAdmin } from "@/lib/auth/session";
import { SiteHeader } from "@/components/public-site/site-header";
import { AccountMenu } from "@/components/public-site/account-menu";
import { SiteFooter } from "@/components/public-site/site-footer";

export default async function PrivacyPage({
  params,
}: PageProps<"/salon/[slug]/privacidad">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) notFound();

  const [membership, platformAdmin] = await Promise.all([
    getSalonMembership(salon.id),
    isPlatformAdmin(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        salon={salon}
        isStaff={!!membership}
        isPlatformAdmin={platformAdmin}
        accountSlot={<AccountMenu salon={salon} />}
      />
      <div className="px-6 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <h1 className="font-heading text-3xl text-foreground">
            Manejo de datos personales
          </h1>
          <p className="font-sans text-sm text-muted-foreground">
            {salon.name} recolecta los datos que compartes en este sitio — correo para
            el boletín de novedades, y nombre, correo, teléfono y hoja de vida al
            aplicar a una vacante — únicamente para el propósito con el que los
            entregaste: enviarte novedades del salón, o evaluar tu aplicación laboral.
            No compartimos tus datos con terceros ni los usamos para ningún otro fin.
          </p>
          <p className="font-sans text-sm text-muted-foreground">
            De acuerdo con la Ley 1581 de 2012 (Habeas Data) de Colombia, puedes
            solicitar en cualquier momento acceder, corregir o eliminar tus datos
            {salon.contact_email ? (
              <>
                {" "}
                escribiendo a{" "}
                <a href={`mailto:${salon.contact_email}`} className="underline hover:text-foreground">
                  {salon.contact_email}
                </a>
                .
              </>
            ) : (
              "."
            )}
          </p>
        </div>
      </div>
      <SiteFooter salon={salon} />
    </div>
  );
}
