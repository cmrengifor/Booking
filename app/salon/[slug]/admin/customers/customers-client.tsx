"use client";

import { useMemo, useState, useTransition } from "react";
import { DateTime } from "luxon";
import { Button } from "@/components/ui/button";
import { sendUpcomingReminder, sendWinBackReminder } from "./actions";
import type { CustomerBucket, CustomerRecord } from "./data";

const BUCKET_ORDER: CustomerBucket[] = ["this_week", "upcoming", "recent", "inactive"];

const BUCKET_LABEL: Record<CustomerBucket, string> = {
  this_week: "Esta semana",
  upcoming: "Citas pendientes",
  recent: "Cita completada",
  inactive: ">30 días sin agendar",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Abierta",
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No asistió",
};

export function CustomersClient({
  customers,
  slug,
  timezone,
}: {
  customers: CustomerRecord[];
  slug: string;
  timezone: string;
}) {
  const [query, setQuery] = useState("");
  const [openBuckets, setOpenBuckets] = useState<Record<CustomerBucket, boolean>>({
    this_week: true,
    upcoming: false,
    recent: false,
    inactive: false,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.fullName.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    );
  }, [customers, query]);

  const grouped = useMemo(() => {
    const map: Record<CustomerBucket, CustomerRecord[]> = {
      this_week: [],
      upcoming: [],
      recent: [],
      inactive: [],
    };
    for (const c of filtered) map[c.bucket].push(c);
    return map;
  }, [filtered]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre o email…"
        className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      {BUCKET_ORDER.map((bucket) => (
        <div key={bucket}>
          <button
            type="button"
            onClick={() => setOpenBuckets((prev) => ({ ...prev, [bucket]: !prev[bucket] }))}
            className="flex items-center gap-2 font-heading text-lg text-foreground"
          >
            <span>{openBuckets[bucket] ? "▾" : "▸"}</span>
            {BUCKET_LABEL[bucket]} ({grouped[bucket].length})
          </button>
          {openBuckets[bucket] && (
            <ul className="mt-3 flex flex-col gap-2">
              {grouped[bucket].map((c) => (
                <CustomerRow
                  key={c.id}
                  customer={c}
                  bucket={bucket}
                  slug={slug}
                  timezone={timezone}
                  isExpanded={expanded.has(c.id)}
                  onToggle={() => toggleExpanded(c.id)}
                />
              ))}
              {!grouped[bucket].length && (
                <p className="font-sans text-sm text-muted-foreground">Nada aquí.</p>
              )}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function CustomerRow({
  customer,
  bucket,
  slug,
  timezone,
  isExpanded,
  onToggle,
}: {
  customer: CustomerRecord;
  bucket: CustomerBucket;
  slug: string;
  timezone: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleReminder() {
    setMessage(null);
    startTransition(async () => {
      const result =
        bucket === "this_week" && customer.nextAppointment
          ? await sendUpcomingReminder(customer.id, customer.nextAppointment.id, timezone)
          : await sendWinBackReminder(customer.id, slug);
      setMessage(result.error ?? "Recordatorio enviado (demo, sin envío real).");
    });
  }

  return (
    <li className="rounded-md border border-border px-4 py-3 font-sans text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="text-left text-foreground hover:text-gold"
        >
          {customer.fullName} {isExpanded ? "▾" : "▸"}
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {customer.phone ?? "Sin teléfono"}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {customer.email ?? "Sin email"}
          </span>
          {customer.distinctActiveMonths >= 2 && (
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">Recurrente</span>
          )}
        </div>
      </div>

      {(bucket === "this_week" || bucket === "inactive") && (
        <div className="mt-2 flex items-center gap-2">
          <Button size="xs" variant="outline" type="button" onClick={handleReminder} disabled={pending}>
            {pending ? "Enviando…" : "Enviar recordatorio"}
          </Button>
          {message && <span className="font-sans text-xs text-muted-foreground">{message}</span>}
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <div>
            <p className="font-sans text-xs font-medium text-foreground">Últimas citas</p>
            <ul className="mt-1 flex flex-col gap-1">
              {customer.lastFive.map((a) => (
                <li key={a.id} className="font-sans text-xs text-muted-foreground">
                  {DateTime.fromISO(a.starts_at).setZone(timezone).setLocale("es").toFormat("d LLL yyyy")} ·{" "}
                  {a.serviceName}
                  {a.artistName && ` · ${a.artistName}`} · {STATUS_LABEL[a.status] ?? a.status}
                </li>
              ))}
              {!customer.lastFive.length && (
                <li className="font-sans text-xs text-muted-foreground">Sin citas todavía.</li>
              )}
            </ul>
          </div>
          <div>
            <p className="font-sans text-xs font-medium text-foreground">Actividad mensual (citas completadas)</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {customer.monthlyActivity.map((m) => (
                <li
                  key={m.month}
                  className="rounded-md bg-muted/40 px-2 py-1 font-sans text-xs text-muted-foreground"
                >
                  {m.month}: {m.count}
                </li>
              ))}
              {!customer.monthlyActivity.length && (
                <li className="font-sans text-xs text-muted-foreground">Sin actividad en los últimos 12 meses.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}
