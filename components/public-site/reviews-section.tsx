import Link from "next/link";
import { Reveal } from "./reveal";
import { MotionColumn } from "./motion-column";
import { buttonVariants } from "@/components/ui/button";

type ReviewRow = {
  rating: number;
  comment: string | null;
  services: { name: string } | null;
  salon_memberships: { artist_profiles: { display_name: string } | null } | null;
};

/** Below this many reviews-with-comments, a two-column scrolling wall
 *  reads as the same handful of cards looping past too fast — the plain
 *  grid (previous design) holds up better at low volume. */
const WALL_MIN_REVIEWS = 4;

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ReviewCard({ review }: { review: ReviewRow }) {
  const artist = review.salon_memberships?.artist_profiles?.display_name;
  return (
    <div className="w-full rounded-md border border-border bg-background p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 font-heading text-xs text-gold">
          {artist ? initials(artist) : "★"}
        </div>
        <div className="min-w-0">
          <p className="truncate font-sans text-sm text-foreground">
            {artist ?? "Clienta verificada"}
          </p>
          <p className="text-xs text-gold">{"★".repeat(review.rating)}</p>
        </div>
      </div>
      <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
        {review.comment}
      </p>
      {review.services?.name && (
        <p className="mt-3 font-mono text-xs text-muted-foreground/70 uppercase">
          {review.services.name}
        </p>
      )}
    </div>
  );
}

export function ReviewsSection({ slug, reviews }: { slug: string; reviews: ReviewRow[] }) {
  const withComments = reviews.filter((r) => r.comment);
  if (!withComments.length) return null;

  const avgRating =
    withComments.reduce((sum, r) => sum + r.rating, 0) / withComments.length;

  if (withComments.length < WALL_MIN_REVIEWS) {
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

  const columnA = withComments.filter((_, i) => i % 2 === 0);
  const columnB = withComments.filter((_, i) => i % 2 === 1);

  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32">
      <Reveal className="mx-auto grid max-w-6xl gap-16 sm:grid-cols-2 sm:items-center sm:gap-12">
        <div className="flex flex-col gap-6">
          <h2 className="max-w-sm font-heading text-4xl leading-[1.05] text-foreground italic sm:text-5xl">
            No es lo que decimos nosotros, es lo que dicen ellas
          </h2>
          <p className="max-w-sm font-sans text-base text-muted-foreground">
            Recorre lo que nuestras clientas cuentan después de su cita.
          </p>
          <Link
            href={`/salon/${slug}/book`}
            className={buttonVariants({ className: "w-fit rounded-full px-8" })}
          >
            Reservar una cita
          </Link>
          <div className="mt-4 flex items-center gap-8">
            <div>
              <p className="font-sans text-xs tracking-[0.2em] text-muted-foreground uppercase">
                Reseñas
              </p>
              <p className="font-heading text-3xl text-foreground">{withComments.length}+</p>
            </div>
            <div>
              <p className="font-sans text-xs tracking-[0.2em] text-muted-foreground uppercase">
                Calificación
              </p>
              <p className="font-heading text-3xl text-gold">
                {avgRating.toFixed(1)} <span className="text-lg">★★★★★</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid h-[520px] grid-cols-2 gap-4 sm:h-[600px]">
          <MotionColumn direction="up" gap={16}>
            {columnA.map((review, i) => (
              <ReviewCard key={i} review={review} />
            ))}
          </MotionColumn>
          <MotionColumn direction="up" gap={16} className="mt-10">
            {columnB.map((review, i) => (
              <ReviewCard key={i} review={review} />
            ))}
          </MotionColumn>
        </div>
      </Reveal>
    </section>
  );
}
