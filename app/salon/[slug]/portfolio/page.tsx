import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";
import { getSalonMembership, isPlatformAdmin } from "@/lib/auth/session";
import { SiteHeader } from "@/components/public-site/site-header";
import { AccountMenu } from "@/components/public-site/account-menu";
import { SiteFooter } from "@/components/public-site/site-footer";
import { MotionRow } from "@/components/public-site/motion-row";
import { cn } from "@/lib/utils";

const RANDOM_COUNT = 6;
const PER_ARTIST_COUNT = 10;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default async function PortfolioPage({
  params,
  searchParams,
}: PageProps<"/salon/[slug]/portfolio">) {
  const { slug } = await params;
  const { artist: artistFilter } = await searchParams;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) notFound();

  const supabase = await createClient();
  const [membership, platformAdmin, { data: artists }, { data: items }] = await Promise.all([
    getSalonMembership(salon.id),
    isPlatformAdmin(),
    supabase
      .from("artist_profiles")
      .select("salon_membership_id, display_name")
      .eq("salon_id", salon.id)
      .eq("published", true)
      .order("sort_order"),
    supabase
      .from("portfolio_items")
      .select("*")
      .eq("salon_id", salon.id)
      .eq("published", true)
      .order("sort_order"),
  ]);

  const selectedArtistId = typeof artistFilter === "string" ? artistFilter : null;
  const selectedArtist = artists?.find((a) => a.salon_membership_id === selectedArtistId);

  const visibleItems = selectedArtist
    ? (items ?? [])
        .filter((i) => i.salon_membership_id === selectedArtist.salon_membership_id)
        .slice(0, PER_ARTIST_COUNT)
    : shuffle(items ?? []).slice(0, RANDOM_COUNT);

  const reel = (items ?? []).slice(0, 16).map((i) => ({
    id: i.id,
    src: i.image_url,
    alt: i.title ?? "Trabajo del salón",
  }));

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        salon={salon}
        isStaff={!!membership}
        isPlatformAdmin={platformAdmin}
        accountSlot={<AccountMenu salon={salon} />}
      />
      {reel.length > 0 && (
        <div className="pt-10 sm:pt-14">
          <MotionRow items={reel} cardWidth={240} gap={16} cornerRadius={2} />
        </div>
      )}
      <div className="px-6 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-heading text-4xl italic text-foreground sm:text-5xl">
            Portafolio
          </h1>

          <h2 className="mt-10 font-sans text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Artistas
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/salon/${slug}/portfolio`}
              className={cn(
                "rounded-full border px-4 py-2 font-sans text-sm transition-colors",
                !selectedArtist
                  ? "border-gold text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              Todos
            </Link>
            {artists?.map((artist) => (
              <Link
                key={artist.salon_membership_id}
                href={`/salon/${slug}/portfolio?artist=${artist.salon_membership_id}`}
                className={cn(
                  "rounded-full border px-4 py-2 font-sans text-sm transition-colors",
                  selectedArtist?.salon_membership_id === artist.salon_membership_id
                    ? "border-gold text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {artist.display_name}
              </Link>
            ))}
          </div>

          {visibleItems.length ? (
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-square overflow-hidden rounded-sm"
                >
                  <Image
                    src={item.image_url}
                    alt={item.title ?? ""}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-10 font-sans text-sm text-muted-foreground">
              Todavía no hay fotos para este artista.
            </p>
          )}
        </div>
      </div>
      <SiteFooter salon={salon} />
    </div>
  );
}
