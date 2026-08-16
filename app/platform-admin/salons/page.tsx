import { createClient } from "@/lib/supabase/server";

export default async function PlatformAdminSalonsPage() {
  const supabase = await createClient();
  const { data: salons } = await supabase
    .from("salons")
    .select("id, name, slug, status")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
        Platform Admin
      </p>
      <h1 className="mt-2 font-heading text-3xl text-foreground">Salones</h1>
      <ul className="mt-6 flex flex-col gap-2">
        {salons?.map((salon) => (
          <li
            key={salon.id}
            className="flex items-center justify-between rounded-md border border-border px-4 py-3 font-sans text-sm"
          >
            <span>{salon.name}</span>
            <span className="text-muted-foreground">{salon.status}</span>
          </li>
        ))}
        {!salons?.length && (
          <p className="font-sans text-sm text-muted-foreground">
            No hay salones todavía.
          </p>
        )}
      </ul>
    </div>
  );
}
