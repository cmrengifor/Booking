import { Reveal } from "./reveal";
import { ImageCarousel } from "./image-carousel";
import { MotionRow } from "./motion-row";
import type { Tables } from "@/types/database";

type PortfolioItem = Tables<"portfolio_items">;
type ArtistProfile = Tables<"artist_profiles">;
type ReviewWithService = {
  salon_membership_id: string;
  rating: number;
  comment: string | null;
  services: { name: string } | null;
};

/**
 * Grouped per artist — artist, then their obras in a carousel, then one
 * service review from that artist — rather than a flat undifferentiated
 * grid (improvements backlog item 5).
 */
export function PortfolioSection({
  items,
  artists,
  reviews,
}: {
  items: PortfolioItem[];
  artists: ArtistProfile[];
  reviews: ReviewWithService[];
}) {
  const artistsWithWork = artists.filter((a) =>
    items.some((i) => i.salon_membership_id === a.salon_membership_id)
  );
  if (!artistsWithWork.length) return null;

  const highlightReel = items.slice(0, 14).map((i) => ({
    id: i.id,
    src: i.image_url,
    alt: i.title ?? "Trabajo del salón",
  }));

  return (
    <section id="portfolio" className="bg-ink py-24 text-ink-foreground sm:py-32">
      <div className="mx-auto flex max-w-5xl flex-col gap-20 px-6 sm:px-10">
        <h2 className="font-heading text-4xl italic sm:text-5xl">Portfolio</h2>
      </div>
      {highlightReel.length > 0 && (
        <Reveal className="mt-2">
          <MotionRow
            items={highlightReel}
            cardWidth={220}
            gap={14}
            cornerRadius={2}
            className="py-2"
          />
        </Reveal>
      )}
      <div className="mx-auto flex max-w-5xl flex-col gap-20 px-6 pt-20 sm:px-10">
        {artistsWithWork.map((artist) => {
          const obras = items
            .filter((i) => i.salon_membership_id === artist.salon_membership_id)
            .map((i) => ({ id: i.id, src: i.image_url, alt: i.title ?? artist.display_name }));
          const review = reviews.find(
            (r) => r.salon_membership_id === artist.salon_membership_id && r.comment
          );

          return (
            <Reveal key={artist.id} className="flex flex-col gap-6">
              <h3 className="font-heading text-2xl text-ink-foreground/90">{artist.display_name}</h3>
              <ImageCarousel images={obras} />
              {review && (
                <div className="max-w-lg">
                  <p className="font-heading text-xl leading-snug italic">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                  <p className="mt-2 font-sans text-sm text-ink-foreground/60">
                    {"★".repeat(review.rating)}
                    {review.services?.name && ` — ${review.services.name}`}
                  </p>
                </div>
              )}
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
