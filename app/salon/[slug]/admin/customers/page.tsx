import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getSalonMembership } from "@/lib/auth/session";
import { loadCustomers } from "./data";
import { CustomersClient } from "./customers-client";

export default async function AdminCustomersPage({
  params,
}: PageProps<"/salon/[slug]/admin/customers">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const membership = await getSalonMembership(salon.id);
  const { customers, canSeeContact } = await loadCustomers(salon.id, salon.timezone, membership);

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Panel del salón
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">Clientes</h1>
      </div>

      <CustomersClient
        customers={customers}
        slug={slug}
        timezone={salon.timezone}
        canSeeContact={canSeeContact}
      />
    </div>
  );
}
