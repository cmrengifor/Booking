import { describe, expect, it } from "vitest";
import { resolveGoBackTarget } from "./booking-navigation";

describe("resolveGoBackTarget", () => {
  it("confirmar clears payment fields and resets paymentStepDone", () => {
    expect(resolveGoBackTarget("confirmar", false)).toEqual({
      kind: "clear-params",
      params: ["paymentMethod", "paymentDetail"],
      sideEffects: { resetPaymentStepDone: true },
    });
  });

  it("pago clears startsAt", () => {
    expect(resolveGoBackTarget("pago", false)).toEqual({
      kind: "clear-params",
      params: ["startsAt"],
    });
  });

  it("hora clears date", () => {
    expect(resolveGoBackTarget("hora", false)).toEqual({
      kind: "clear-params",
      params: ["date"],
    });
  });

  it("fecha clears preference and artistId", () => {
    expect(resolveGoBackTarget("fecha", false)).toEqual({
      kind: "clear-params",
      params: ["preference", "artistId"],
    });
  });

  it("artista clears serviceId/variantId and re-expands the current service", () => {
    expect(resolveGoBackTarget("artista", false)).toEqual({
      kind: "clear-params",
      params: ["serviceId", "variantId"],
      sideEffects: { expandCurrentService: true },
    });
  });

  it("servicio when a variant is still needed just clears serviceId/variantId", () => {
    expect(resolveGoBackTarget("servicio", true)).toEqual({
      kind: "clear-params",
      params: ["serviceId", "variantId"],
    });
  });

  it("servicio when no variant is needed also resets the location step", () => {
    expect(resolveGoBackTarget("servicio", false)).toEqual({
      kind: "clear-params",
      params: ["serviceId", "variantId"],
      sideEffects: { expandCurrentService: true, resetLocationStepDone: true },
    });
  });

  it("ubicacion navigates home instead of clearing params", () => {
    expect(resolveGoBackTarget("ubicacion", false)).toEqual({ kind: "navigate-home" });
  });

  it("returns null for an unrecognized step instead of guessing", () => {
    // @ts-expect-error deliberately invalid step to exercise the fallback branch
    expect(resolveGoBackTarget("not-a-real-step", false)).toBeNull();
  });
});
