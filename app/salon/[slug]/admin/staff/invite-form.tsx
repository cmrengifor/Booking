"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inviteStaffMember } from "./actions";

const ROLE_OPTIONS = [
  { value: "manager", label: "Manager" },
  { value: "receptionist", label: "Recepción" },
  { value: "stylist", label: "Artista" },
];

export function InviteForm({
  salonId,
  salonName,
  slug,
  locations,
  canInviteOwner,
}: {
  salonId: string;
  salonName: string;
  slug: string;
  locations: { id: string; name: string }[];
  canInviteOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const options = canInviteOwner ? [{ value: "owner", label: "Dueño/a" }, ...ROLE_OPTIONS] : ROLE_OPTIONS;

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await inviteStaffMember(salonId, salonName, slug, formData);
      setMessage(result.error ?? "Invitación enviada.");
    });
  }

  return (
    <div className="rounded-md border border-border p-4">
      <h2 className="font-heading text-lg text-foreground">Invitar staff</h2>
      <form action={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="font-sans text-[11px] text-muted-foreground">Correo</label>
          <input
            name="email"
            type="email"
            required
            className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-sans text-[11px] text-muted-foreground">Rol</label>
          <select
            name="role"
            required
            defaultValue=""
            className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              Elegir rol…
            </option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-sans text-[11px] text-muted-foreground">Sede (opcional)</label>
          <select
            name="location_id"
            defaultValue=""
            className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Sin sede asignada</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="xs" disabled={pending}>
          {pending ? "Enviando…" : "Enviar invitación"}
        </Button>
      </form>
      {message && <p className="mt-2 font-sans text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
