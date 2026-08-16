import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getSalonMembership } from "@/lib/auth/session";

export default async function AdminOverviewPage({
  params,
}: PageProps<"/salon/[slug]/admin">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  const membership = salon ? await getSalonMembership(salon.id) : null;

  return (
    <div className="p-8">
      <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
        Panel del salón
      </p>
      <h1 className="mt-2 font-heading text-3xl text-foreground">
        {salon?.name}
      </h1>
      <p className="mt-2 font-sans text-sm text-muted-foreground">
        Conectado como {membership?.role}. Calendario, citas, staff y
        servicios llegan en las fases 3 y 7.
      </p>
    </div>
  );
}
