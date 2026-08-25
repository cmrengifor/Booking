"use client";

import { createContext, useContext } from "react";

/** Deep-link fields a "Reservar [service/artist]" button can preselect —
 *  same fields the /book route reads from its own URL query string. */
export type BookingPreselect = {
  serviceId?: string;
  variantId?: string;
  preference?: "specific" | "any";
  artistId?: string;
  locationId?: string;
};

type BookingDrawerContextValue = {
  /** Overwrites the drawer's current selection and jumps straight to it —
   *  a deliberate new booking intent, not a merge with whatever was there. */
  preselect: (params: BookingPreselect) => void;
};

export const BookingDrawerContext = createContext<BookingDrawerContextValue | null>(null);

export function useBookingDrawer() {
  const ctx = useContext(BookingDrawerContext);
  if (!ctx) {
    throw new Error("useBookingDrawer must be used within the salon layout's <GlobalBookingDrawer>.");
  }
  return ctx;
}
