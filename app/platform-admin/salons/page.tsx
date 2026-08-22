import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { assertNoQueryErrors } from "@/lib/supabase/assert";
import { CreateSalonForm } from "./create-salon-form";
import { StatusToggle } from "./status-toggle";

export default async function PlatformAdminSalonsPage() {
  const supabase = await createClient();
  const salonsRes = await supabase
    .from("salons")
    .select("id, name, slug, status")
    .order("created_at", { ascending: false });
  assertNoQueryErrors([salonsRes], "Failed to load salons");
  const { data: salons } = salonsRes;

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Platform Admin
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">Salones</h1>
      </div>

      <CreateSalonForm />

      <ul className="flex flex-col gap-2">
        {salons?.map((salon) => (
          <li
            key={salon.id}
            className="flex items-center justify-between rounded-md border border-border px-4 py-3 font-sans text-sm"
          >
            <Link href={`/salon/${salon.slug}`} className="text-foreground transition-colors hover:text-gold">
              {salon.name}
            </Link>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2 py-0.5 font-sans text-[11px] font-medium ${
                  salon.status === "active"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-red-500/15 text-red-600"
                }`}
              >
                {salon.status === "active" ? "Activo" : "Suspendido"}
              </span>
              <StatusToggle salonId={salon.id} status={salon.status} />
            </div>
          </li>
        ))}
        {!salons?.length && (
          <p className="font-sans text-sm text-muted-foreground">No hay salones todavía.</p>
        )}
      </ul>
    </div>
  );
}
