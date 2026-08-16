import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: salons } = await supabase
    .from("salons")
    .select("slug, name, hero_subtitle")
    .eq("status", "active")
    .order("name");

  if (salons?.length === 1) {
    redirect(`/salon/${salons[0].slug}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 bg-background px-6 py-24 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Beauty Salon SaaS
        </p>
        <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground italic">
          Encuentra tu salón
        </h1>
      </div>

      {salons && salons.length > 0 ? (
        <ul className="flex w-full max-w-sm flex-col gap-3">
          {salons.map((salon) => (
            <li key={salon.slug}>
              <Link
                href={`/salon/${salon.slug}`}
                className="block rounded-md border border-border px-6 py-4 text-left transition-colors hover:border-gold"
              >
                <span className="font-heading text-lg text-foreground italic">
                  {salon.name}
                </span>
                {salon.hero_subtitle ? (
                  <span className="mt-1 block font-sans text-sm text-muted-foreground">
                    {salon.hero_subtitle}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="max-w-md font-sans text-sm text-muted-foreground">
          No hay salones activos en este momento.
        </p>
      )}
    </div>
  );
}
