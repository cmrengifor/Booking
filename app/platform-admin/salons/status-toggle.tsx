"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setSalonStatus } from "./actions";

export function StatusToggle({
  salonId,
  status,
}: {
  salonId: string;
  status: "active" | "suspended";
}) {
  const [pending, startTransition] = useTransition();
  const isActive = status === "active";

  function handleClick() {
    const confirmMessage = isActive
      ? "¿Suspender este salón? Dejará de ser visible públicamente."
      : "¿Reactivar este salón?";
    if (!window.confirm(confirmMessage)) return;
    startTransition(() => setSalonStatus(salonId, isActive ? "suspended" : "active"));
  }

  return (
    <Button variant="outline" size="xs" type="button" onClick={handleClick} disabled={pending}>
      {isActive ? "Suspender" : "Reactivar"}
    </Button>
  );
}
