"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Tables } from "@/types/database";
import { Stepper } from "./stepper";
import { TimePicker } from "./time-picker";
import { confirmBooking, getAvailableSlots } from "./actions";

type Salon = Tables<"salons">;
type Location = { id: string; name: string; address: string | null };
type Service = Tables<"services">;
type Variant = Tables<"service_variants">;
type Artist = {
  salon_membership_id: string;
  display_name: string;
  bio: string | null;
  location_id: string | null;
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function BookingWizard(props: {
  salon: Salon;
  locations: Location[];
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
  locations,
  services,
  variants,
  artists,
}: {
  salon: Salon;
  locations: Location[];
  services: Service[];
  variants: Variant[];
  artists: Artist[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const locationId = searchParams.get("locationId");
  const serviceId = searchParams.get("serviceId");
  const variantId = searchParams.get("variantId");
  const preference = searchParams.get("preference") as "specific" | "any" | null;
  const artistId = searchParams.get("artistId");
  const date = searchParams.get("date");
  const startsAt = searchParams.get("startsAt");

  // Local-only: expanding a service-with-variants must never touch the URL
  // (it's still the same step) — only the final leaf choice (a service with
  // no variants, or a chosen variant) commits to searchParams and advances
  // the wizard. Committing on every intermediate click used to read as "it
  // took me somewhere else" even though it was still step 2.
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

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

  // Single-location salons skip straight past a pointless one-option step.
  useEffect(() => {
    if (!locationId && locations.length === 1) {
      setParams({ locationId: locations[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount / whenever locationId clears
  }, [locationId, locations]);

  const locationArtists = artists.filter((a) => a.location_id === locationId);

  const selectedService = services.find((s) => s.id === serviceId);
  const serviceVariants = variants.filter((v) => v.service_id === serviceId);
  // True when a deep link (the "Reservar" button on a service card) sets
  // serviceId directly for a service that still needs a variant chosen —
  // distinct from the local-only cascade below, which never touches the URL
  // for intermediate clicks.
  const needsVariant = !!selectedService?.has_variants && !variantId;

  useEffect(() => {
    if (!locationId || !serviceId || !preference || !date) return;
    if (preference === "specific" && !artistId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-deps-change loading flag, not a render loop
    setLoadingSlots(true);
    setError(null);
    getAvailableSlots({
      salonId: salon.id,
      locationId,
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
  }, [locationId, serviceId, variantId, preference, artistId, date, salon.id, salon.timezone]);

  async function handleConfirm() {
    if (!locationId || !serviceId || !preference || !startsAt) return;
    setConfirming(true);
    setError(null);
    try {
      await confirmBooking({
        salonId: salon.id,
        locationId,
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
          Te confirmaremos por correo a {userEmail}. Revisa el estado de tu cita en tu cuenta.
        </p>
        <Link href={`/salon/${salon.slug}/account`} className={buttonVariants({ className: "mt-2" })}>
          Ir a mi cuenta
        </Link>
      </div>
    );
  }

  // Step number for the progress indicator.
  const step = !locationId
    ? 1
    : !serviceId || needsVariant
      ? 2
      : !preference
        ? 3
        : !date
          ? 4
          : !startsAt
            ? 5
            : 6;

  function goBack() {
    if (startsAt) return setParams({ startsAt: null });
    if (date) return setParams({ date: null });
    if (preference) return setParams({ preference: null, artistId: null });
    if (serviceId) {
      setExpandedServiceId(serviceId);
      return setParams({ serviceId: null, variantId: null });
    }
    if (locationId) return setParams({ locationId: null });
    router.push(`/salon/${salon.slug}`);
  }

  const whenText = startsAt
    ? (() => {
        const dt = DateTime.fromISO(startsAt).setZone(salon.timezone).setLocale("es");
        return `${capitalize(dt.toFormat("cccc"))} ${dt.toFormat("d")} ${capitalize(
          dt.toFormat("LLLL")
        )}, ${dt.toFormat("HH:mm")}`;
      })()
    : "";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-8">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Volver
        </button>
        <Stepper current={step} />
      </div>

      {/* Step 1: location */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-2xl text-foreground">Elige una ubicación</h1>
          <div className="flex flex-col gap-2">
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() =>
                  setParams({ locationId: loc.id, preference: null, artistId: null })
                }
                className="w-full rounded-md border border-border px-4 py-3 text-left font-sans text-sm hover:border-gold"
              >
                <span className="text-foreground">{loc.name}</span>
                {loc.address && <span className="block text-muted-foreground">{loc.address}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2, deep-link entry: "Reservar" on a service card set serviceId
          directly for a service that still needs a variant — show just that
          service's variants rather than the full list. */}
      {step === 2 && needsVariant && selectedService && (
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-2xl text-foreground">{selectedService.name}</h1>
          <ul className="flex flex-col gap-2">
            {serviceVariants.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
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
      )}

      {/* Step 2: service — single flat list, no category grouping, cascading to variants. */}
      {step === 2 && !needsVariant && (
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-2xl text-foreground">Servicios</h1>
          <ul className="divide-y divide-border rounded-md border border-border">
            {services.map((s) => {
              const isServiceExpanded = expandedServiceId === s.id;
              const sVariants = variants.filter((v) => v.service_id === s.id);
              return (
                <li key={s.id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() =>
                      s.has_variants
                        ? setExpandedServiceId(isServiceExpanded ? null : s.id)
                        : setParams({ serviceId: s.id, variantId: null })
                    }
                    className="flex w-full items-center justify-between text-left font-sans text-sm"
                  >
                    <span className="text-foreground">{s.name}</span>
                    {!s.has_variants && (
                      <span className="text-muted-foreground">
                        ${s.base_price} · {s.base_duration_minutes} min
                      </span>
                    )}
                    {s.has_variants && (
                      <span className="text-muted-foreground">
                        {isServiceExpanded ? "–" : `${sVariants.length} opciones`}
                      </span>
                    )}
                  </button>
                  {s.has_variants && isServiceExpanded && (
                    <ul className="mt-2 flex flex-col gap-2 border-l border-border pl-4">
                      {sVariants.map((v) => (
                        <li key={v.id}>
                          <button
                            type="button"
                            onClick={() => setParams({ serviceId: s.id, variantId: v.id })}
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
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Step 3: technician — "Cualquiera disponible" fija primero */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-2xl text-foreground">¿Con quién?</h1>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setParams({ preference: "any", artistId: null })}
              className="w-full rounded-md border border-border px-4 py-3 text-left font-sans text-sm hover:border-gold"
            >
              Cualquier artista disponible
            </button>
            {locationArtists.map((a) => (
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
        </div>
      )}

      {/* Step 4: date, native calendar dropdown */}
      {step === 4 && (
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-2xl text-foreground">Elige una fecha</h1>
          <input
            type="date"
            value={date ?? ""}
            min={DateTime.now().setZone(salon.timezone).toISODate() ?? undefined}
            onChange={(e) => setParams({ date: e.target.value })}
            className="w-full max-w-xs rounded-md border border-input bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* Step 5: time — vertical carousel + analog clock */}
      {step === 5 && (
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-2xl text-foreground">Elige un horario</h1>
          {loadingSlots && (
            <p className="font-sans text-sm text-muted-foreground">Buscando horarios…</p>
          )}
          {error && <p className="font-sans text-sm text-destructive">{error}</p>}
          {!loadingSlots && !error && (
            <TimePicker
              timezone={salon.timezone}
              slots={slots}
              selected={startsAt}
              onSelect={(iso) => setParams({ startsAt: iso })}
            />
          )}
        </div>
      )}

      {/* Step 6: summary + email confirmation + confirm */}
      {step === 6 && (
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-2xl text-foreground">Confirmar</h1>
          <div className="rounded-md border border-border p-4 font-sans text-sm">
            <p>
              <span className="text-muted-foreground">Sede:</span>{" "}
              {locations.find((l) => l.id === locationId)?.name}
            </p>
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
              <span className="text-muted-foreground">Cuándo:</span> {whenText} — COT (UTC-5)
            </p>
          </div>

          <div className="rounded-md border border-border p-4">
            <p className="font-sans text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Confirmación por correo
            </p>
            {userEmail ? (
              <p className="mt-1 font-sans text-sm text-foreground">
                Te enviaremos la confirmación, con el enlace para reagendar o cancelar, a{" "}
                <span className="text-gold">{userEmail}</span>.
              </p>
            ) : (
              <p className="mt-1 font-sans text-sm text-muted-foreground">
                Inicia sesión para ver a qué correo se enviará tu confirmación.
              </p>
            )}
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
            <Button onClick={handleConfirm} disabled={confirming} size="lg" className="w-fit px-8">
              {confirming ? "Confirmando…" : "CONFIRMAR CITA"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
