"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { declinePending } from "./actions";

const REASONS = [
  { value: "artist_unavailable", label: "Artista no disponible en ese horario" },
  { value: "time_conflict", label: "El horario ya no está disponible" },
  { value: "other", label: "Otro" },
];

export function DeclineForm({ appointmentId, slug }: { appointmentId: string; slug: string }) {
  const [reason, setReason] = useState("artist_unavailable");

  return (
    <form
      action={declinePending.bind(null, appointmentId, slug)}
      className="flex flex-wrap items-center gap-2"
    >
      <select
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
      >
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {reason === "other" && (
        <input
          name="custom_reason"
          placeholder="Motivo…"
          className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
        />
      )}
      <Button size="sm" variant="destructive" type="submit">
        Rechazar
      </Button>
    </form>
  );
}
