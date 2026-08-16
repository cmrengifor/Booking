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

  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(
    categories.find((c) => services.some((s) => s.id === serviceId && s.category_id === c.id))
      ?.id ?? categories[0]?.id ?? null
  );

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
  const needsVariant = !!selectedService?.has_variants && !variantId;

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
          Te confirmaremos por correo a {userEmail}. Revisa el estado de tu cita en tu cuenta.
        </p>
        <Link href={`/salon/${salon.slug}/account`} className={buttonVariants({ className: "mt-2" })}>
          Ir a mi cuenta
        </Link>
      </div>
    );
  }

  // Step number for the progress indicator.
  const step = !serviceId || needsVariant ? 1 : !preference ? 2 : !date ? 3 : !startsAt ? 4 : 5;

  function goBack() {
    if (startsAt) return setParams({ startsAt: null });
    if (date) return setParams({ date: null });
    if (preference) return setParams({ preference: null, artistId: null });
    if (variantId) return setParams({ variantId: null });
    if (serviceId) return setParams({ serviceId: null, variantId: null });
    router.push(`/salon/${salon.slug}`);
  }

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

      {/* Step 1: service, cascading category -> service -> variant */}
      {step === 1 && !needsVariant && (
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-2xl text-foreground">Elige un servicio</h1>
          <div className="flex flex-col gap-2">
            {categories.map((cat) => {
              const isExpanded = expandedCategoryId === cat.id;
              return (
                <div key={cat.id} className="rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => setExpandedCategoryId(isExpanded ? null : cat.id)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left font-heading text-lg text-foreground"
                  >
                    {cat.name}
                    <span className="font-sans text-sm text-muted-foreground">
                      {isExpanded ? "–" : "+"}
                    </span>
                  </button>
                  {isExpanded && (
                    <ul className="flex flex-col gap-2 border-t border-border px-4 py-3">
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
                              {s.has_variants && (
                                <span className="text-muted-foreground">
                                  ({variants.filter((v) => v.service_id === s.id).length} opciones)
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 1b: variant picker, cascading under the chosen service */}
      {step === 1 && needsVariant && selectedService && (
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-2xl text-foreground">{selectedService.name}</h1>
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
      )}

      {/* Step 2: technician — "Cualquiera disponible" fija primero */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-2xl text-foreground">¿Con quién?</h1>
          <div className="flex flex-col gap-2">
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
        </div>
      )}

      {/* Step 3: date, native calendar dropdown */}
      {step === 3 && (
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

      {/* Step 4: time — carousel 8am-8pm + analog clock */}
      {step === 4 && (
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

      {/* Step 5: summary + email confirmation + confirm */}
      {step === 5 && (
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-2xl text-foreground">Confirmar</h1>
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
              {DateTime.fromISO(startsAt!).setZone(salon.timezone).toFormat("cccc d LLLL, HH:mm")} (
              {salon.timezone})
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
