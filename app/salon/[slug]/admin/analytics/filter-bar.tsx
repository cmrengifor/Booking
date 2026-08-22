"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RANGE_LABELS, type RangeMode } from "./range";

const MODES: RangeMode[] = ["day", "week", "month", "quarter", "semester"];

export function AnalyticsFilters({
  services,
  todayIso,
  showExport = true,
}: {
  services: { id: string; name: string }[];
  todayIso: string;
  /** The export route always produces a salon-wide workbook — never show
   *  this link on a scoped (single-artist) view, since it would silently
   *  hand back more than the page itself displays. */
  showExport?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mode = (searchParams.get("range") as RangeMode) ?? "month";
  const ref = searchParams.get("ref") ?? todayIso;
  const serviceId = searchParams.get("service") ?? "all";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const exportParams = new URLSearchParams(searchParams.toString());
  if (!exportParams.get("range")) exportParams.set("range", mode);
  if (!exportParams.get("ref")) exportParams.set("ref", ref);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap gap-1">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setParam("range", m)}
            className={`rounded-md px-3 py-1.5 font-sans text-xs transition-colors ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "border border-input text-muted-foreground hover:text-foreground"
            }`}
          >
            {RANGE_LABELS[m]}
          </button>
        ))}
      </div>
      <input
        type="date"
        value={ref}
        onChange={(e) => setParam("ref", e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
      />
      <select
        value={serviceId}
        onChange={(e) => setParam("service", e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="all">Todos los servicios</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {showExport && (
        <a
          href={`${pathname}/export?${exportParams.toString()}`}
          className="ml-auto rounded-md border border-input px-3 py-1.5 font-sans text-xs text-foreground transition-colors hover:border-gold"
        >
          Descargar Excel
        </a>
      )}
    </div>
  );
}
