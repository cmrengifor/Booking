/**
 * Pure step-back logic for the booking wizard. Each branch clears whatever
 * field gates the PREVIOUS step, not the current one — the current step's
 * own gating field is already unset (that's precisely why the wizard is on
 * this step), so clearing it again would be a no-op that silently breaks
 * "Volver". Kept separate from booking-wizard.tsx so this branching can be
 * tested without React Testing Library, which this repo doesn't have.
 */

export type Step =
  | "ubicacion"
  | "servicio"
  | "artista"
  | "fecha"
  | "hora"
  | "pago"
  | "confirmar";

export type GoBackTarget =
  | {
      kind: "clear-params";
      params: string[];
      sideEffects?: {
        resetPaymentStepDone?: boolean;
        expandCurrentService?: boolean;
        resetLocationStepDone?: boolean;
      };
    }
  | { kind: "navigate-home" };

/** Returns null for a step this function doesn't recognize — the caller
 *  should log a warning and take no action rather than silently no-op. */
export function resolveGoBackTarget(
  currentStep: Step,
  needsVariant: boolean
): GoBackTarget | null {
  switch (currentStep) {
    case "confirmar":
      return {
        kind: "clear-params",
        params: ["paymentMethod", "paymentDetail"],
        sideEffects: { resetPaymentStepDone: true },
      };
    case "pago":
      return { kind: "clear-params", params: ["startsAt"] };
    case "hora":
      return { kind: "clear-params", params: ["date"] };
    case "fecha":
      return { kind: "clear-params", params: ["preference", "artistId"] };
    case "artista":
      return {
        kind: "clear-params",
        params: ["serviceId", "variantId"],
        sideEffects: { expandCurrentService: true },
      };
    case "servicio":
      if (needsVariant) {
        return { kind: "clear-params", params: ["serviceId", "variantId"] };
      }
      return {
        kind: "clear-params",
        params: ["serviceId", "variantId"],
        sideEffects: { expandCurrentService: true, resetLocationStepDone: true },
      };
    case "ubicacion":
      return { kind: "navigate-home" };
    default:
      return null;
  }
}
