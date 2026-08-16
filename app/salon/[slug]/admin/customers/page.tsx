import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";

export default async function AdminCustomersPage({
  params,
}: PageProps<"/salon/[slug]/admin/customers">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, created_at, profiles(full_name, phone), appointments(id)")
    .eq("salon_id", salon.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Panel del salón
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">Clientes</h1>
      </div>

      <ul className="flex flex-col gap-2">
        {customers?.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-md border border-border px-4 py-3 font-sans text-sm"
          >
            <div>
              <p className="text-foreground">{c.profiles?.full_name ?? "Sin nombre"}</p>
              <p className="text-muted-foreground">{c.profiles?.phone ?? "Sin teléfono"}</p>
            </div>
            <span className="text-muted-foreground">
              {c.appointments?.length ?? 0} cita(s)
            </span>
          </li>
        ))}
        {!customers?.length && (
          <p className="font-sans text-sm text-muted-foreground">Sin clientes todavía.</p>
        )}
      </ul>
    </div>
  );
}
