"use client";

import type { ReactNode } from "react";
import { DrawerTrigger } from "@/components/ui/drawer";
import { bookingDrawerHandle } from "@/lib/booking/booking-drawer-handle";
import { useBookingDrawer, type BookingPreselect } from "./booking-drawer-context";

/**
 * A "Reservar" button anywhere on the site — opens the one global booking
 * drawer (mounted in the salon layout) in place, no navigation. Pass
 * `preselect` to deep-link straight to a specific service/artist, the way
 * a service card's own "Reservar" button does; omit it for a plain
 * "Reservar una cita" entry point that resumes whatever was already open.
 */
export function BookingTrigger({
  preselect,
  className,
  children,
}: {
  preselect?: BookingPreselect;
  className?: string;
  children: ReactNode;
}) {
  const { preselect: setPreselect } = useBookingDrawer();

  return (
    <DrawerTrigger
      handle={bookingDrawerHandle}
      className={className}
      onClick={() => {
        if (preselect) setPreselect(preselect);
      }}
    >
      {children}
    </DrawerTrigger>
  );
}
