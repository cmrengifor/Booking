"use client";

import { useSalon } from "@/lib/tenant/salon-context";

// Placeholder public landing. Real landing page is Phase 10 (impeccable).
export default function SalonHomePage() {
  const salon = useSalon();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
        {salon.status === "active" ? "Open for booking" : "Preview"}
      </p>
      <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground italic">
        {salon.name}
      </h1>
      <p className="max-w-md font-sans text-sm text-muted-foreground">
        Public landing page placeholder — the real one is built in Phase 10.
        Timezone: {salon.timezone}.
      </p>
    </div>
  );
}
