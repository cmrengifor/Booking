"use client";

import { useState } from "react";
import { DateTime } from "luxon";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/types/database";
import { getAvailableSlots } from "@/app/salon/[slug]/book/actions";
import { submitReschedule } from "./actions";

type Salon = Tables<"salons">;

export function RescheduleForm({
  salon,
  appointment,
}: {
  salon: Salon;
  appointment: {
    id: string;
    service_id: string;
    service_variant_id: string | null;
    artist_preference: "specific" | "any";
    salon_membership_id: string | null;
    location_id: string;
  };
}) {
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDateChange(value: string) {
    setDate(value);
    setSlots([]);
    setError(null);
    if (!value) return;
    setLoading(true);
    try {
      const result = await getAvailableSlots({
        salonId: salon.id,
        locationId: appointment.location_id,
        timezone: salon.timezone,
        serviceId: appointment.service_id,
        variantId: appointment.service_variant_id,
        artistPreference: appointment.artist_preference,
        salonMembershipId: appointment.salon_membership_id,
        date: value,
      });
      setSlots(result.availableSlots);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar disponibilidad.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePick(slot: string) {
    setSubmitting(true);
    setError(null);
    try {
      await submitReschedule(appointment.id, salon.slug, slot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reagendar.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="date"
        value={date}
        min={DateTime.now().setZone(salon.timezone).toISODate() ?? undefined}
        onChange={(e) => handleDateChange(e.target.value)}
        className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {loading && <p className="font-sans text-sm text-muted-foreground">Buscando horarios…</p>}
      {error && <p className="font-sans text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {slots.map((s) => (
          <Button
            key={s}
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => handlePick(s)}
          >
            {DateTime.fromISO(s).setZone(salon.timezone).toFormat("HH:mm")}
          </Button>
        ))}
      </div>
    </div>
  );
}
