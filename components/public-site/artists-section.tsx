import { Reveal } from "./reveal";
import { MotionRow } from "./motion-row";
import type { Tables } from "@/types/database";

type ArtistProfile = Tables<"artist_profiles">;

export function ArtistsSection({
  artists,
}: {
  artists: ArtistProfile[];
}) {
  const headshotReel = artists
    .filter((a) => a.headshot_url)
    .map((a) => ({ id: a.id, src: a.headshot_url as string, alt: a.display_name }));

  if (!headshotReel.length) return null;

  return (
    <section id="artistas" className="py-24 sm:py-32">
      <div className="mx-auto flex max-w-5xl flex-col gap-20 px-6 sm:px-10">
        <h2 className="font-heading text-4xl italic text-foreground sm:text-5xl">
          Nuestros Artistas
        </h2>
      </div>
      <Reveal className="my-2">
        <MotionRow items={headshotReel} direction="right" cardWidth={220} gap={14} cornerRadius={2} />
      </Reveal>
    </section>
  );
}
