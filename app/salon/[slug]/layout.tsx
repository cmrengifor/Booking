import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { SalonProvider } from "@/lib/tenant/salon-context";
import { getBookingData } from "@/lib/booking/get-booking-data";
import { GlobalBookingDrawer } from "@/components/public-site/global-booking-drawer";

export default async function SalonLayout({
  children,
  params,
}: LayoutProps<"/salon/[slug]">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);

  if (!salon) notFound();

  const bookingData = await getBookingData(salon.id);

  return (
    <SalonProvider salon={salon}>
      <GlobalBookingDrawer salon={salon} data={bookingData}>
        {children}
      </GlobalBookingDrawer>
      <Toaster position="top-right" richColors />
    </SalonProvider>
  );
}
