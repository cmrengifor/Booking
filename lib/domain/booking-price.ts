/**
 * Pure price calculation for the booking wizard's confirmation summary.
 * Mirrors the pricing inputs `book_appointment` (the RPC) actually charges
 * on — see supabase/migrations/20260816011409_appointments_rls_and_rpcs.sql —
 * without touching the DB, so the client can show the same number it's
 * about to submit.
 */

export function computeBookingPrice(
  service: { base_price: number | null },
  variant: { price: number } | null,
  isHomeService: boolean,
  zone: { surcharge: number } | null
): number | null {
  const base = variant ? variant.price : service.base_price;
  if (base == null) return null;
  const surcharge = isHomeService && zone ? zone.surcharge : 0;
  return base + surcharge;
}
