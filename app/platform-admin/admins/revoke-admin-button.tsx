"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { revokePlatformAdmin } from "./actions";

export function RevokeAdminButton({ profileId }: { profileId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm("¿Revocar el acceso de platform admin de esta persona?")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await revokePlatformAdmin(profileId);
      if (result.error) setMessage(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="ghost" size="xs" type="button" onClick={handleClick} disabled={pending}>
        Revocar
      </Button>
      {message && <p className="max-w-40 text-right font-sans text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
