"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Drawer } from "@/components/ui/drawer";
import { bookingDrawerHandle } from "@/lib/booking/booking-drawer-handle";
import type { BookingData } from "@/lib/booking/get-booking-data";
import type { Tables } from "@/types/database";
import {
  BookingWizardContent,
  EMPTY_BOOKING_PARAMS,
  type BookingParams,
} from "@/app/salon/[slug]/book/booking-wizard-content";
import { BookingDrawerContext, type BookingPreselect } from "./booking-drawer-context";

type Salon = Tables<"salons">;

/**
 * The booking drawer, mounted once in the salon layout so every "Reservar"
 * button on every page (via <BookingTrigger>, sharing bookingDrawerHandle)
 * can open it in place — no navigation to /book. Selection state lives here
 * in memory rather than the URL: it survives closing and reopening the
 * drawer (locationId/serviceId/etc. persist), but NOT a real page
 * navigation away from the salon's pages, which is exactly why the
 * "needs login" step still hands off to the real /book route — that's a
 * genuine navigation either way, so it has to be URL-backed to survive it.
 */
export function GlobalBookingDrawer({
  salon,
  data,
  children,
}: {
  salon: Salon;
  data: BookingData;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [params, setParamsState] = useState<BookingParams>(EMPTY_BOOKING_PARAMS);

  const setParams = useCallback((next: Partial<BookingParams>) => {
    setParamsState((prev) => ({ ...prev, ...next }));
  }, []);

  // A specific service/artist "Reservar" button is a deliberate new
  // booking intent — it overwrites whatever was selected before rather
  // than merging into it, same as navigating a fresh `/book?serviceId=…`
  // link always did.
  const preselect = useCallback((next: BookingPreselect) => {
    setParamsState({ ...EMPTY_BOOKING_PARAMS, ...next });
  }, []);

  return (
    <BookingDrawerContext.Provider value={{ preselect }}>
      {children}
      <Drawer
        handle={bookingDrawerHandle}
        open={open}
        onOpenChange={setOpen}
        swipeDirection="down"
        showSwipeHandle
      >
        <BookingWizardContent
          salon={salon}
          {...data}
          params={params}
          setParams={setParams}
          requestClose={() => setOpen(false)}
        />
      </Drawer>
    </BookingDrawerContext.Provider>
  );
}
