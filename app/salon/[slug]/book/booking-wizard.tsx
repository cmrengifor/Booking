"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Tables } from "@/types/database";
import { confirmBooking, getAvailableSlots } from "./actions";

type Salon = Tables<"salons">;
type Category = Tables<"service_categories">;
type Service = Tables<"services">;
type Variant = Tables<"service_variants">;
type Artist = { salon_membership_id: string; display_name: string; bio: string | null };

export function BookingWizard(props: {
  salon: Salon;
  categories: Category[];
  services: Service[];
  variants: Variant[];
  artists: Artist[];
}) {
  return (
    <Suspense fallback={null}>
      <BookingWizardInner {...props} />
    </Suspense>
  );
}

function BookingWizardInner({
  salon,
  categories,
  services,
  variants,
  artists,
}: {
  salon: Salon;
  categories: Category[];
  services: Service[];
  variants: Variant[];
  artists: Artist[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const serviceId = searchParams.get("serviceId");
  const variantId = searchParams.get("variantId");
  const preference = searchParams.get("preference") as "specific" | "any" | null;
  const artistId = searchParams.get("artistId");
  const date = searchParams.get("date");
  const startsAt = searchParams.get("startsAt");

  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  function setParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`?${params.toString()}`);
  }

  const selectedService = services.find((s) => s.id === serviceId);
  const serviceVariants = variants.filter((v) => v.service_id === serviceId);

  useEffect(() => {
    if (!serviceId || !preference || !date) return;
    if (preference === "specific" && !artistId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-deps-change loading flag, not a render loop
    setLoadingSlots(true);
    setError(null);
    getAvailableSlots({
      salonId: salon.id,
      timezone: salon.timezone,
      serviceId,
      variantId: variantId || null,
      artistPreference: preference,
      salonMembershipId: preference === "specific" ? artistId : null,
      date,
    })
      .then(setSlots)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingSlots(false));
  }, [serviceId, variantId, preference, artistId, date, salon.id, salon.timezone]);

  async function handleConfirm() {
    if (!serviceId || !preference || !startsAt) return;
    setConfirming(true);
    setError(null);
    try {
      await confirmBooking({
        salonId: salon.id,
        serviceId,
        variantId: variantId || null,
        artistPreference: preference,
        salonMembershipId: preference === "specific" ? artistId : null,
        startsAt,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar la reserva.");
    } finally {
      setConfirming(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Reserva enviada
        </p>
        <h1 className="font-heading text-3xl text-foreground">¡Listo!</h1>
        <p className="max-w-md font-sans text-sm text-muted-foreground">
          Revisa el estado de tu cita en tu cuenta.
        </p>
        <Link href={`/salon/${salon.slug}/account`} className={buttonVariants({ className: "mt-2" })}>
          Ir a mi cuenta
        </Link>
      </div>
    );
  }

  // Step 1: service
  if (!serviceId) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <StepHeader salon={salon} step={1} label="Elige un servicio" />
        {categories.map((cat) => (
          <div key={cat.id}>
            <h2 className="font-heading text-lg text-foreground">{cat.name}</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {services
                .filter((s) => s.category_id === cat.id)
                .map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setParams({ serviceId: s.id, variantId: null })}
                      className="w-full rounded-md border border-border px-4 py-3 text-left font-sans text-sm hover:border-gold"
                    >
                      <span className="text-foreground">{s.name}</span>{" "}
                      {!s.has_variants && (
                        <span className="text-muted-foreground">
                          ${s.base_price} · {s.base_duration_minutes} min
                        </span>
                      )}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  // 1b: variant picker, if the service has variants and none chosen yet
  if (selectedService?.has_variants && !variantId) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <StepHeader salon={salon} step={1} label={selectedService.name} />
        <ul className="flex flex-col gap-2">
          {serviceVariants.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => setParams({ variantId: v.id })}
                className="w-full rounded-md border border-border px-4 py-3 text-left font-sans text-sm hover:border-gold"
              >
                <span className="text-foreground">{v.name}</span>{" "}
                <span className="text-muted-foreground">
                  ${v.price} · {v.duration_minutes} min
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Step 2: artist preference
  if (!preference) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <StepHeader salon={salon} step={2} label="¿Con quién?" />
        <button
          onClick={() => setParams({ preference: "any", artistId: null })}
          className="w-full rounded-md border border-border px-4 py-3 text-left font-sans text-sm hover:border-gold"
        >
          Cualquier artista disponible
        </button>
        {artists.map((a) => (
          <button
            key={a.salon_membership_id}
            onClick={() => setParams({ preference: "specific", artistId: a.salon_membership_id })}
            className="w-full rounded-md border border-border px-4 py-3 text-left font-sans text-sm hover:border-gold"
          >
            <span className="text-foreground">{a.display_name}</span>
            {a.bio && <span className="block text-muted-foreground">{a.bio}</span>}
          </button>
        ))}
      </div>
    );
  }

  // Step 3: date + time
  if (!startsAt) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <StepHeader salon={salon} step={3} label="Fecha y hora" />
        <input
          type="date"
          value={date ?? ""}
          min={DateTime.now().setZone(salon.timezone).toISODate() ?? undefined}
          onChange={(e) => setParams({ date: e.target.value })}
          className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {loadingSlots && (
          <p className="font-sans text-sm text-muted-foreground">Buscando horarios…</p>
        )}
        {error && <p className="font-sans text-sm text-destructive">{error}</p>}
        {date && !loadingSlots && slots.length === 0 && !error && (
          <p className="font-sans text-sm text-muted-foreground">
            Sin horarios disponibles ese día.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <button
              key={s}
              onClick={() => setParams({ startsAt: s })}
              className="rounded-md border border-border px-3 py-2 font-sans text-sm hover:border-gold"
            >
              {DateTime.fromISO(s).setZone(salon.timezone).toFormat("HH:mm")}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 4: confirm (auth required)
  return (
    <div className="flex flex-col gap-6 p-8">
      <StepHeader salon={salon} step={4} label="Confirmar" />
      <div className="rounded-md border border-border p-4 font-sans text-sm">
        <p>
          <span className="text-muted-foreground">Servicio:</span>{" "}
          {selectedService?.name}
          {variantId && ` — ${serviceVariants.find((v) => v.id === variantId)?.name}`}
        </p>
        <p>
          <span className="text-muted-foreground">Con:</span>{" "}
          {preference === "any"
            ? "Cualquier artista disponible"
            : artists.find((a) => a.salon_membership_id === artistId)?.display_name}
        </p>
        <p>
          <span className="text-muted-foreground">Cuándo:</span>{" "}
          {DateTime.fromISO(startsAt).setZone(salon.timezone).toFormat("cccc d LLLL, HH:mm")} (
          {salon.timezone})
        </p>
      </div>

      {error && <p className="font-sans text-sm text-destructive">{error}</p>}

      {userEmail === undefined ? null : userEmail === null ? (
        <Link
          href={`/auth/login?next=${encodeURIComponent(
            `/salon/${salon.slug}/book?${searchParams.toString()}`
          )}`}
          className={buttonVariants()}
        >
          Inicia sesión para confirmar
        </Link>
      ) : (
        <Button onClick={handleConfirm} disabled={confirming}>
          {confirming ? "Confirmando…" : "Confirmar reserva"}
        </Button>
      )}
    </div>
  );
}

function StepHeader({ salon, step, label }: { salon: Salon; step: number; label: string }) {
  return (
    <div>
      <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
        {salon.name} · Paso {step} de 4
      </p>
      <h1 className="mt-2 font-heading text-2xl text-foreground">{label}</h1>
    </div>
  );
}
