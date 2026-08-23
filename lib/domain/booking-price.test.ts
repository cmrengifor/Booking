import { describe, expect, it } from "vitest";
import { computeBookingPrice } from "./booking-price";

const acrylics = { base_price: 55 };
const gelVariant = { price: 40 };
const zoneChapinero = { surcharge: 8 };

describe("computeBookingPrice", () => {
  it("uses the service base price when there's no variant", () => {
    expect(computeBookingPrice(acrylics, null, false, null)).toBe(55);
  });

  it("uses the variant price over the service base price", () => {
    expect(computeBookingPrice(acrylics, gelVariant, false, null)).toBe(40);
  });

  it("adds the home-service surcharge when enabled with a zone", () => {
    expect(computeBookingPrice(acrylics, null, true, zoneChapinero)).toBe(63);
  });

  it("ignores the surcharge when home service is off, even with a zone present", () => {
    expect(computeBookingPrice(acrylics, null, false, zoneChapinero)).toBe(55);
  });

  it("ignores the surcharge when home service is on but no zone is selected yet", () => {
    expect(computeBookingPrice(acrylics, null, true, null)).toBe(55);
  });

  it("returns null for a service with variants and no matching variant (stale/deleted variantId)", () => {
    const serviceWithVariants = { base_price: null };
    expect(computeBookingPrice(serviceWithVariants, null, false, null)).toBeNull();
  });
});
