"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function DeleteButton({
  action,
  id,
  slug,
  confirmMessage,
}: {
  action: (id: string, slug: string) => Promise<{ error: string | null; archived: boolean }>;
  id: string;
  slug: string;
  confirmMessage: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await action(id, slug);
      if (result.error) {
        setMessage(result.error);
      } else if (result.archived) {
        setMessage("Tiene historial asociado — se archivó en lugar de eliminarse.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="ghost" size="xs" type="button" onClick={handleClick} disabled={pending}>
        Eliminar
      </Button>
      {message && <p className="max-w-40 text-right font-sans text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
