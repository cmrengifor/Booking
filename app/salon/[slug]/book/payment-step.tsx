"use client";

type Method = "pse" | "transferencia" | "efectivo";

const DENOMINATIONS = ["2.000", "5.000", "10.000", "20.000", "50.000", "100.000"];

export function PaymentStep({
  method,
  detail,
  onChange,
}: {
  method: Method | null;
  detail: string;
  onChange: (method: Method, detail: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl text-foreground">¿Cómo prefieres pagar?</h1>
      <p className="font-sans text-sm text-muted-foreground">
        Esto solo registra tu preferencia — el pago se coordina directamente con el salón. Aún no
        procesamos pagos en línea.
      </p>

      <div className="flex flex-col gap-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 has-checked:border-gold">
          <input
            type="radio"
            name="payment-method"
            checked={method === "pse"}
            onChange={() => onChange("pse", "")}
            className="mt-1"
          />
          <div>
            <p className="font-sans text-sm font-medium text-foreground">PSE</p>
            <p className="font-sans text-xs text-muted-foreground">
              Desde cualquier banco. Cuenta receptora por confirmar con el salón.
            </p>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 has-checked:border-gold">
          <input
            type="radio"
            name="payment-method"
            checked={method === "transferencia"}
            onChange={() => onChange("transferencia", "")}
            className="mt-1"
          />
          <div className="flex-1">
            <p className="font-sans text-sm font-medium text-foreground">Transferencia</p>
            {method === "transferencia" && (
              <div className="mt-2 flex gap-2">
                {(["llave_bre_b", "nequi"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onChange("transferencia", opt)}
                    className={`rounded-md border px-3 py-1.5 font-sans text-xs transition-colors ${
                      detail === opt
                        ? "border-gold bg-gold/10 text-foreground"
                        : "border-input text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt === "llave_bre_b" ? "Llave Bre-B" : "Nequi"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 has-checked:border-gold">
          <input
            type="radio"
            name="payment-method"
            checked={method === "efectivo"}
            onChange={() => onChange("efectivo", "pago_exacto")}
            className="mt-1"
          />
          <div className="flex-1">
            <p className="font-sans text-sm font-medium text-foreground">Efectivo</p>
            {method === "efectivo" && (
              <div className="mt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onChange("efectivo", "pago_exacto")}
                  className={`w-fit rounded-md border px-3 py-1.5 font-sans text-xs transition-colors ${
                    detail === "pago_exacto"
                      ? "border-gold bg-gold/10 text-foreground"
                      : "border-input text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pago exacto
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-sans text-xs text-muted-foreground">
                    Necesito cambio de:
                  </span>
                  {DENOMINATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onChange("efectivo", `cambio_${d}`)}
                      className={`rounded-md border px-2.5 py-1 font-sans text-xs transition-colors ${
                        detail === `cambio_${d}`
                          ? "border-gold bg-gold/10 text-foreground"
                          : "border-input text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      ${d}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}
