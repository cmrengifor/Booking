"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addTimeOff, removeTimeOff, updateStaffProfile, updateStaffSchedule } from "./actions";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

type WeeklyHour = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
};

type TimeOff = { id: string; start_date: string; end_date: string; reason: string | null };

type DayState = {
  off: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
};

function buildInitialDays(hours: WeeklyHour[]): DayState[] {
  return Array.from({ length: 7 }, (_, day) => {
    const existing = hours.find((h) => h.day_of_week === day);
    return existing
      ? {
          off: false,
          startTime: existing.start_time.slice(0, 5),
          endTime: existing.end_time.slice(0, 5),
          breakStart: existing.break_start?.slice(0, 5) ?? "",
          breakEnd: existing.break_end?.slice(0, 5) ?? "",
        }
      : { off: true, startTime: "09:00", endTime: "17:00", breakStart: "", breakEnd: "" };
  });
}

export function EditPanel({
  membershipId,
  salonId,
  slug,
  displayName,
  bio,
  hours,
  timeOff,
}: {
  membershipId: string;
  salonId: string;
  slug: string;
  displayName: string;
  bio: string;
  hours: WeeklyHour[];
  timeOff: TimeOff[];
}) {
  const [name, setName] = useState(displayName);
  const [bioText, setBioText] = useState(bio);
  const [days, setDays] = useState<DayState[]>(() => buildInitialDays(hours));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function updateDay(index: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const profileResult = await updateStaffProfile(membershipId, slug, (() => {
        const fd = new FormData();
        fd.set("display_name", name);
        fd.set("bio", bioText);
        return fd;
      })());
      if (profileResult.error) {
        setMessage(profileResult.error);
        return;
      }
      const scheduleResult = await updateStaffSchedule(
        membershipId,
        salonId,
        slug,
        days.map((d, i) => ({
          dayOfWeek: i,
          off: d.off,
          startTime: d.startTime,
          endTime: d.endTime,
          breakStart: d.breakStart,
          breakEnd: d.breakEnd,
        }))
      );
      if (scheduleResult.error) {
        setMessage(scheduleResult.error);
        return;
      }
      setMessage("Guardado.");
    });
  }

  function handleAddTimeOff(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await addTimeOff(membershipId, salonId, slug, formData);
      if (result.error) setMessage(result.error);
    });
  }

  function handleRemoveTimeOff(id: string) {
    startTransition(() => removeTimeOff(id, slug));
  }

  return (
    <div className="mt-3 flex flex-col gap-4 rounded-md border border-dashed border-border/70 p-3">
      <div className="flex flex-col gap-2">
        <label className="font-sans text-xs font-medium text-foreground">Nombre visible</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="font-sans text-xs font-medium text-foreground">Bio</label>
        <textarea
          value={bioText}
          onChange={(e) => setBioText(e.target.value)}
          rows={2}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <p className="font-sans text-xs font-medium text-foreground">Horario semanal</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {days.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 font-sans text-xs">
              <span className="w-8 text-muted-foreground">{DAY_LABELS[i]}</span>
              <label className="flex items-center gap-1 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={d.off}
                  onChange={(e) => updateDay(i, { off: e.target.checked })}
                />
                Libre
              </label>
              {!d.off && (
                <>
                  <input
                    type="time"
                    value={d.startTime}
                    onChange={(e) => updateDay(i, { startTime: e.target.value })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={d.endTime}
                    onChange={(e) => updateDay(i, { endTime: e.target.value })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="ml-2 text-muted-foreground">break</span>
                  <input
                    type="time"
                    value={d.breakStart}
                    onChange={(e) => updateDay(i, { breakStart: e.target.value })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={d.breakEnd}
                    onChange={(e) => updateDay(i, { breakEnd: e.target.value })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="font-sans text-xs font-medium text-foreground">Vacaciones / ausencias</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {timeOff.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 font-sans text-xs">
              <span className="text-muted-foreground">
                {t.start_date} – {t.end_date}
                {t.reason && ` · ${t.reason}`}
              </span>
              <Button
                variant="ghost"
                size="xs"
                type="button"
                disabled={pending}
                onClick={() => handleRemoveTimeOff(t.id)}
              >
                Quitar
              </Button>
            </div>
          ))}
          {!timeOff.length && (
            <p className="font-sans text-xs text-muted-foreground">Sin ausencias registradas.</p>
          )}
          <form action={handleAddTimeOff} className="mt-1 flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[11px] text-muted-foreground">Desde</label>
              <input
                name="start_date"
                type="date"
                required
                className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[11px] text-muted-foreground">Hasta</label>
              <input
                name="end_date"
                type="date"
                required
                className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[11px] text-muted-foreground">Motivo (opcional)</label>
              <input
                name="reason"
                className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" size="xs" disabled={pending}>
              Agregar
            </Button>
          </form>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
        {message && <span className="font-sans text-xs text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
