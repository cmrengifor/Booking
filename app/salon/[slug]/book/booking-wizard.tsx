"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import type { Tables } from "@/types/database";
import type { BookingData } from "@/lib/booking/get-booking-data";
import { BookingWizardContent, type BookingParams } from "./booking-wizard-content";

type Salon = Tables<"salons">;
type PaymentMethod = "pse" | "transferencia" | "efectivo";

/**
 * The /book route — the deep-linkable entry point (email links, direct
 * navigation, shared URLs, and the "needs login" handoff from the global
 * drawer). State lives in the URL, same as always; the drawer opens the
 * instant this route mounts and closing it navigates back to the salon
 * home page. For in-app "Reservar" buttons that open the drawer without
 * leaving the page, see components/public-site/global-booking-drawer.tsx —
 * both render the same <BookingWizardContent>.
 */
export function BookingWizard(props: BookingData & { salon: Salon }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params: BookingParams = {
    locationId: searchParams.get("locationId"),
    serviceId: searchParams.get("serviceId"),
    variantId: searchParams.get("variantId"),
    preference: searchParams.get("preference") as "specific" | "any" | null,
    artistId: searchParams.get("artistId"),
    date: searchParams.get("date"),
    startsAt: searchParams.get("startsAt"),
    paymentMethod: searchParams.get("paymentMethod") as PaymentMethod | null,
    paymentDetail: searchParams.get("paymentDetail"),
    // Carried along from the reagendar email link, if this booking started
    // there — confirmBooking marks the token used only once this booking
    // actually succeeds, not when the link was merely opened.
    rescheduleToken: searchParams.get("rescheduleToken"),
  };

  function setParams(next: Partial<BookingParams>) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) nextSearchParams.delete(key);
      else nextSearchParams.set(key, value);
    }
    router.push(`?${nextSearchParams.toString()}`);
  }

  // Opens the instant this route mounts; closing it (X, swipe-down, outside
  // click, Escape) waits for the close animation to finish before
  // navigating home, so the slide-down isn't cut short by an immediate
  // route change.
  const [drawerOpen, setDrawerOpen] = useState(true);
  function handleDrawerOpenChangeComplete(nextOpen: boolean) {
    if (!nextOpen) router.push(`/salon/${props.salon.slug}`);
  }

  return (
    <Drawer
      open={drawerOpen}
      onOpenChange={setDrawerOpen}
      onOpenChangeComplete={handleDrawerOpenChangeComplete}
      swipeDirection="down"
      showSwipeHandle
    >
      <BookingWizardContent
        {...props}
        params={params}
        setParams={setParams}
        requestClose={() => setDrawerOpen(false)}
      />
    </Drawer>
  );
}
