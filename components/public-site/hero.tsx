import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Salon } from "@/lib/tenant/resolve-salon";

export function Hero({ salon }: { salon: Salon }) {
  return (
    <section className="relative flex h-[92vh] min-h-[560px] w-full items-end overflow-hidden">
      {salon.hero_image_url && (
        <Image
          src={salon.hero_image_url}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />

      <div className="relative z-10 flex w-full flex-col gap-6 px-6 pb-16 sm:px-10 sm:pb-24">
        <h1 className="max-w-3xl font-heading text-6xl leading-[0.95] font-medium tracking-tight text-white italic sm:text-8xl">
          {salon.hero_title ?? salon.name}
        </h1>
        {salon.hero_subtitle && (
          <p className="max-w-md font-sans text-lg text-white/80">
            {salon.hero_subtitle}
          </p>
        )}
        <Link
          href={`/salon/${salon.slug}/book`}
          className={buttonVariants({
            // `!` forces these to win over the variant's own bg-primary/
            // text-primary-foreground — tailwind-merge doesn't dedupe
            // custom-theme color utilities against each other, so without
            // `!` the two class lists can both survive and the wrong one
            // wins the cascade (this is what caused white-on-white text).
            className:
              "mt-2 h-auto w-fit rounded-full bg-white! px-8 py-4 text-base font-medium text-black! shadow-lg shadow-black/20 hover:bg-white/85! sm:text-lg",
          })}
        >
          Reservar una cita
        </Link>
      </div>
    </section>
  );
}
