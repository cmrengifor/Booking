import type { Tables } from "@/types/database";

type Brand = Tables<"brands">;

export function BrandsSection({ brands }: { brands: Brand[] }) {
  return (
    <section className="border-y border-border px-6 py-10 sm:px-10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-12 gap-y-4">
        {brands.map((brand) => (
          <span
            key={brand.id}
            className="font-heading text-lg text-muted-foreground/70 italic"
          >
            {brand.name}
          </span>
        ))}
      </div>
    </section>
  );
}
