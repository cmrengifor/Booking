"use client";

import { useState, useTransition } from "react";
import { AvatarPicker } from "@/components/kokonutui/avatar-picker";
import { Button } from "@/components/ui/button";
import { PRESET_AVATARS } from "@/lib/avatars";
import { updateAvatar } from "./actions";

export function AvatarPickerSection({
  slug,
  initialSelectedId,
}: {
  slug: string;
  initialSelectedId: number | null;
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? PRESET_AVATARS[0].id);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex max-w-sm flex-col gap-4 rounded-md border border-border p-4">
      <h2 className="font-sans text-sm font-medium text-foreground">Avatar</h2>
      <AvatarPicker
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setSaved(false);
        }}
      />
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const formData = new FormData();
            formData.set("avatar_id", String(selectedId));
            await updateAvatar(slug, formData);
            setSaved(true);
          })
        }
      >
        {pending ? "Guardando…" : saved ? "Guardado" : "Guardar"}
      </Button>
    </div>
  );
}
