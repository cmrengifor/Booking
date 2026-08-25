import Link from "next/link";
import { Reveal } from "./reveal";
import { ImageCarousel } from "./image-carousel";
import { BookingTrigger } from "./booking-trigger";
import { buttonVariants } from "@/components/ui/button";
import type { Tables } from "@/types/database";

type Category = Tables<"service_categories">;
type Service = Tables<"services">;
type Variant = Tables<"service_variants">;
type PortfolioItem = Tables<"portfolio_items">;

/** Highest price under this service — what "flagship" ranking sorts by. */
function rankingPrice(service: Service, variants: Variant[]) {
  if (!service.has_variants) return service.base_price ?? 0;
  const prices = variants.filter((v) => v.service_id === service.id).map((v) => v.price);
  return prices.length ? Math.max(...prices) : 0;
}

export function ServicesSection({
  slug,
  categories,
  services,
  variants,
  portfolio,
}: {
  slug: string;
  categories: Category[];
  services: Service[];
  variants: Variant[];
  portfolio: PortfolioItem[];
}) {
  return (
    <section id="servicios" className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto flex max-w-5xl flex-col gap-16">
        <div className="flex justify-end">
          <Link
            href={`/salon/${slug}/portfolio`}
            className="font-sans text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver Portafolio →
          </Link>
        </div>
        {categories.map((category) => (
          <Reveal key={category.id} className="grid gap-6 sm:grid-cols-[1fr_2fr] sm:gap-12">
            <h2 className="font-heading text-3xl text-foreground sm:sticky sm:top-28 sm:self-start">
              {category.name}
            </h2>
            <ul className="flex flex-col">
              {services
                .filter((s) => s.category_id === category.id)
                .sort((a, b) => rankingPrice(b, variants) - rankingPrice(a, variants))
                .map((service) => {
                  const serviceVariants = variants.filter((v) => v.service_id === service.id);
                  const servicePhotos = portfolio
                    .filter((p) => p.service_id === service.id)
                    .map((p) => ({ id: p.id, src: p.image_url, alt: p.title ?? service.name }));
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
                      {servicePhotos.length > 0 && (
                        <ImageCarousel images={servicePhotos} className="mt-4" />
                      )}
                      <BookingTrigger
                        preselect={{ serviceId: service.id }}
                        className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4" })}
                      >
                        Reservar
                      </BookingTrigger>
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
