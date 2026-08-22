"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelStaffInvite } from "./actions";

export function CancelInviteButton({ membershipId, slug }: { membershipId: string; slug: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm("¿Cancelar esta invitación?")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await cancelStaffInvite(membershipId, slug);
      if (result.error) setMessage(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="xs" variant="ghost" type="button" disabled={pending} onClick={handleClick}>
        Cancelar
      </Button>
      {message && <p className="max-w-40 text-right font-sans text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
