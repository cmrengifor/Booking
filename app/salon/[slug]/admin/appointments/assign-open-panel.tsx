"use client";

import { useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { takeOpenAppointment } from "./actions";
import { type OpenAppt, type Stylist, appointmentLine } from "./calendar-shared";

export function AssignOpenPanel({
  slug,
  zone,
  stylists,
  openAppointments,
}: {
  slug: string;
  zone: string;
  stylists: Stylist[];
  openAppointments: OpenAppt[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button type="button" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Plus className="size-3.5" />
        Asignar cita
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <p className="font-sans text-xs font-medium text-foreground">Citas abiertas sin asignar</p>
          <div className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto">
            {openAppointments.map((a) => (
              <form
                key={a.id}
                action={async (formData: FormData) => {
                  await takeOpenAppointment(a.id, String(formData.get("stylist")), slug);
                  setOpen(false);
                }}
                className="flex flex-col gap-1.5 rounded-md border border-border p-2"
              >
                <p className="font-sans text-xs text-foreground">
                  {DateTime.fromISO(a.starts_at).setZone(zone).setLocale("es").toFormat("d LLL, H:mm")} —{" "}
                  {appointmentLine(a, null)}
                </p>
                <div className="flex gap-2">
                  <select
                    name="stylist"
                    required
                    className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Asignar a…</option>
                    {stylists.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.artist_profiles?.display_name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="xs">
                    Asignar
                  </Button>
                </div>
              </form>
            ))}
            {!openAppointments.length && (
              <p className="font-sans text-xs text-muted-foreground">No hay citas sin asignar.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
