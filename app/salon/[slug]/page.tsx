import { notFound } from "next/navigation";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/public-site/site-header";
import { Hero } from "@/components/public-site/hero";
import { ServicesSection } from "@/components/public-site/services-section";
import { PortfolioSection } from "@/components/public-site/portfolio-section";
import { ArtistsSection } from "@/components/public-site/artists-section";
import { BrandsSection } from "@/components/public-site/brands-section";
import { ReviewsSection } from "@/components/public-site/reviews-section";
import { FaqSection } from "@/components/public-site/faq-section";
import { NewsletterSection } from "@/components/public-site/newsletter-section";
import { SiteFooter } from "@/components/public-site/site-footer";

export default async function SalonHomePage({
  params,
}: PageProps<"/salon/[slug]">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) notFound();

  const supabase = await createClient();
  const [
    { data: categories },
    { data: services },
    { data: variants },
    { data: portfolio },
    { data: artists },
    { data: brands },
    { data: faqs },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from("service_categories")
      .select("*")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("services")
      .select("*")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("service_variants")
      .select("*")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("portfolio_items")
      .select("*")
      .eq("salon_id", salon.id)
      .eq("published", true)
      .order("sort_order"),
    supabase
      .from("artist_profiles")
      .select("*")
      .eq("salon_id", salon.id)
      .eq("published", true)
      .order("sort_order"),
    supabase
      .from("brands")
      .select("*")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("faqs")
      .select("*")
      .eq("salon_id", salon.id)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("reviews")
      .select(
        "rating, comment, salon_membership_id, services(name), salon_memberships(artist_profiles(display_name))"
      )
      .eq("salon_id", salon.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(9),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader salon={salon} />
      <Hero salon={salon} />
      <ServicesSection
        categories={categories ?? []}
        services={services ?? []}
        variants={variants ?? []}
        portfolio={portfolio ?? []}
      />
      <ArtistsSection slug={slug} artists={artists ?? []} />
      <PortfolioSection
        items={portfolio ?? []}
        artists={artists ?? []}
        reviews={reviews ?? []}
      />
      {brands?.length ? <BrandsSection brands={brands} /> : null}
      {reviews?.length ? <ReviewsSection reviews={reviews} /> : null}
      {faqs?.length ? <FaqSection faqs={faqs} /> : null}
      <NewsletterSection salon={salon} />
      <SiteFooter salon={salon} />
    </div>
  );
}
