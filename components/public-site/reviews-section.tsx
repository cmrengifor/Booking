import { Reveal } from "./reveal";

type ReviewRow = {
  rating: number;
  comment: string | null;
  salon_memberships: { artist_profiles: { display_name: string } | null } | null;
};

export function ReviewsSection({ reviews }: { reviews: ReviewRow[] }) {
  const withComments = reviews.filter((r) => r.comment);
  if (!withComments.length) return null;

  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-12 font-heading text-4xl italic text-foreground sm:text-5xl">
          Reseñas
        </h2>
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          {withComments.slice(0, 6).map((review, i) => (
            <Reveal key={i}>
              <p className="font-heading text-2xl leading-snug text-foreground italic">
                &ldquo;{review.comment}&rdquo;
              </p>
              <p className="mt-4 font-sans text-sm text-muted-foreground">
                <span className="text-gold">{"★".repeat(review.rating)}</span>
                {review.salon_memberships?.artist_profiles?.display_name &&
                  ` — con ${review.salon_memberships.artist_profiles.display_name}`}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
