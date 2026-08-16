"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" /> Volver
    </button>
  );
}
