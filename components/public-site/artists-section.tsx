import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./reveal";
import type { Tables } from "@/types/database";

type ArtistProfile = Tables<"artist_profiles">;

export function ArtistsSection({
  slug,
  artists,
}: {
  slug: string;
  artists: ArtistProfile[];
}) {
  if (!artists.length) return null;

  return (
    <section id="equipo" className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto flex max-w-5xl flex-col gap-20">
        <h2 className="font-heading text-4xl italic text-foreground sm:text-5xl">
          Equipo
        </h2>
        {artists.map((artist, i) => (
          <Reveal
            key={artist.id}
            className={`grid items-center gap-8 sm:grid-cols-2 sm:gap-16 ${
              i % 2 === 1 ? "sm:[&>*:first-child]:order-2" : ""
            }`}
          >
            {artist.headshot_url ? (
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm">
                <Image
                  src={artist.headshot_url}
                  alt={artist.display_name}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="aspect-[4/5] w-full rounded-sm bg-muted" />
            )}
            <div>
              <h3 className="font-heading text-3xl text-foreground">{artist.display_name}</h3>
              {artist.bio && (
                <p className="mt-3 max-w-sm font-sans text-base text-muted-foreground">
                  {artist.bio}
                </p>
              )}
              {artist.specialties?.length ? (
                <p className="mt-4 font-mono text-xs tracking-wide text-gold uppercase">
                  {artist.specialties.join(" · ")}
                </p>
              ) : null}
              <Link
                href={`/salon/${slug}/book`}
                className="mt-6 inline-block border-b border-gold font-sans text-sm text-foreground hover:text-gold"
              >
                Reservar con {artist.display_name.split(" ")[0]}
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
