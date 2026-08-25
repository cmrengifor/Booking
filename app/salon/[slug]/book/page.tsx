import { notFound } from "next/navigation";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getBookingData } from "@/lib/booking/get-booking-data";
import { BookingWizard } from "./booking-wizard";

export default async function BookPage({
  params,
}: PageProps<"/salon/[slug]/book">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) notFound();

  const data = await getBookingData(salon.id);

  return <BookingWizard salon={salon} {...data} />;
}
