"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "../services/delete-button";
import { deleteStaffMember, reactivateStaffMember } from "./actions";
import { EditPanel } from "./edit-panel";

type WeeklyHour = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
};

type TimeOff = { id: string; start_date: string; end_date: string; reason: string | null };

export function StaffActions({
  membershipId,
  salonId,
  slug,
  displayName,
  bio,
  hours,
  timeOff,
  disabled,
}: {
  membershipId: string;
  salonId: string;
  slug: string;
  displayName: string;
  bio: string;
  hours: WeeklyHour[];
  timeOff: TimeOff[];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="xs" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? "Cerrar" : "Editar"}
        </Button>
        {disabled ? (
          <Button
            variant="outline"
            size="xs"
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => reactivateStaffMember(membershipId, slug))}
          >
            Reactivar
          </Button>
        ) : (
          <DeleteButton
            action={deleteStaffMember}
            id={membershipId}
            slug={slug}
            confirmMessage={`¿Eliminar a "${displayName}"? Si tiene citas asociadas, se deshabilitará en su lugar.`}
          />
        )}
      </div>
      {open && (
        <EditPanel
          membershipId={membershipId}
          salonId={salonId}
          slug={slug}
          displayName={displayName}
          bio={bio}
          hours={hours}
          timeOff={timeOff}
        />
      )}
    </div>
  );
}
