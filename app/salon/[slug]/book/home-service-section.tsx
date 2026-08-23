"use client";

type Zone = { id: string; name: string; surcharge: number };

export function HomeServiceSection({
  enabled,
  address,
  zoneId,
  zones,
  onToggle,
  onAddressChange,
  onZoneChange,
}: {
  enabled: boolean;
  address: string;
  zoneId: string | null;
  zones: Zone[];
  onToggle: (enabled: boolean) => void;
  onAddressChange: (address: string) => void;
  onZoneChange: (zoneId: string) => void;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        <span className="font-sans text-sm font-medium text-foreground">
          ¿Deseas servicio a domicilio?
        </span>
      </label>

      {enabled && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-sans text-xs text-muted-foreground">Dirección</label>
            <textarea
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              rows={2}
              placeholder="Calle, número, apto/casa, referencia…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="font-sans text-[11px] text-muted-foreground">
              Un asesor confirma la dirección contigo antes de la cita.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-sans text-xs text-muted-foreground">Barrio / zona</label>
            <select
              value={zoneId ?? ""}
              onChange={(e) => onZoneChange(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecciona una zona…</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} — recargo ${z.surcharge.toLocaleString("es-CO")}
                </option>
              ))}
            </select>
          </div>
          <p className="font-sans text-xs text-muted-foreground">
            El servicio a domicilio requiere correo y celular para poder coordinar la visita.
          </p>
        </div>
      )}
    </div>
  );
}
