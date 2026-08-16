"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";

export function ActiveSwitch({
  action,
  id,
  slug,
  active,
}: {
  action: (id: string, active: boolean, slug: string) => Promise<void>;
  id: string;
  slug: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      size="sm"
      checked={active}
      disabled={pending}
      onCheckedChange={() => startTransition(() => action(id, active, slug))}
    />
  );
}
