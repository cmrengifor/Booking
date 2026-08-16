import { Reveal } from "./reveal";
import type { Tables } from "@/types/database";

type Category = Tables<"service_categories">;
type Service = Tables<"services">;
type Variant = Tables<"service_variants">;

export function ServicesSection({
  categories,
  services,
  variants,
}: {
  categories: Category[];
  services: Service[];
  variants: Variant[];
}) {
  return (
    <section id="servicios" className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto flex max-w-5xl flex-col gap-16">
        {categories.map((category) => (
          <Reveal key={category.id} className="grid gap-6 sm:grid-cols-[1fr_2fr] sm:gap-12">
            <h2 className="font-heading text-3xl text-foreground sm:sticky sm:top-28 sm:self-start">
              {category.name}
            </h2>
            <ul className="flex flex-col">
              {services
                .filter((s) => s.category_id === category.id)
                .map((service) => {
                  const serviceVariants = variants.filter((v) => v.service_id === service.id);
                  return (
                    <li key={service.id} className="border-b border-border py-5 first:pt-0">
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="font-sans text-lg text-foreground">{service.name}</p>
                        {!service.has_variants && (
                          <p className="whitespace-nowrap font-mono text-sm text-gold">
                            ${service.base_price} · {service.base_duration_minutes} min
                          </p>
                        )}
                      </div>
                      {service.description && (
                        <p className="mt-1 max-w-md font-sans text-sm text-muted-foreground">
                          {service.description}
                        </p>
                      )}
                      {service.has_variants && serviceVariants.length > 0 && (
                        <ul className="mt-3 flex flex-col gap-1.5">
                          {serviceVariants.map((v) => (
                            <li
                              key={v.id}
                              className="flex items-baseline justify-between gap-4 font-sans text-sm text-muted-foreground"
                            >
                              <span>{v.name}</span>
                              <span className="whitespace-nowrap font-mono text-gold">
                                ${v.price} · {v.duration_minutes} min
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
            </ul>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
