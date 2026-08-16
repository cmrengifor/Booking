"use client";

import { createContext, useContext } from "react";
import type { Salon } from "./resolve-salon";

const SalonContext = createContext<Salon | null>(null);

export function SalonProvider({
  salon,
  children,
}: {
  salon: Salon;
  children: React.ReactNode;
}) {
  return (
    <SalonContext.Provider value={salon}>{children}</SalonContext.Provider>
  );
}

/** Only for use inside app/salon/[slug]/**, where the layout guarantees a salon. */
export function useSalon(): Salon {
  const salon = useContext(SalonContext);
  if (!salon) {
    throw new Error("useSalon() called outside a salon/[slug] route tree.");
  }
  return salon;
}
