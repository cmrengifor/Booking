"use client";

import { useState } from "react";

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 font-heading text-lg text-foreground"
      >
        <span>{open ? "▾" : "▸"}</span>
        {title}
      </button>
      {open && <ul className="mt-3 flex flex-col gap-2">{children}</ul>}
    </div>
  );
}
