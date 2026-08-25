"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, XIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireProgress,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire";
import type { Tables } from "@/types/database";
import { computeBookingPrice } from "@/lib/domain/booking-price";
import { resolveGoBackTarget, type Step } from "@/lib/domain/booking-navigation";
import { TimePicker } from "./time-picker";
import { PaymentStep } from "./payment-step";
import { HomeServiceSection } from "./home-service-section";
import { confirmBooking, getAvailableSlots, updateMyPhone } from "./actions";

type Salon = Tables<"salons">;
type Location = { id: string; name: string; address: string | null };
type Service = Tables<"services">;
type Variant = Tables<"service_variants">;
type Artist = {
  salon_membership_id: string;
  display_name: string;
  bio: string | null;
  location_id: string | null;
  headshot_url: string | null;
};
type HomeServiceZone = { id: string; name: string; surcharge: number };
type PaymentMethod = "pse" | "transferencia" | "efectivo";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function BookingWizard(props: {
  salon: Salon;
  locations: Location[];
  services: Service[];
  variants: Variant[];
  artists: Artist[];
  homeServiceZones: HomeServiceZone[];
}) {
  return <BookingWizardInner {...props} />;
}

function BookingWizardInner({
  salon,
  locations,
  services,
  variants,
  artists,
  homeServiceZones,
}: {
  salon: Salon;
  locations: Location[];
  services: Service[];
  variants: Variant[];
  artists: Artist[];
  homeServiceZones: HomeServiceZone[];
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
  const paymentMethod = searchParams.get("paymentMethod") as PaymentMethod | null;
  const paymentDetail = searchParams.get("paymentDetail") ?? "";
  // Carried along from the reagendar email link, if this booking started
  // there — confirmBooking marks the token used only once this booking
  // actually succeeds, not when the link was merely opened.
  const rescheduleToken = searchParams.get("rescheduleToken");

  // Local-only: expanding a service-with-variants must never touch the URL
  // (it's still the same step) — only the final leaf choice (a service with
  // no variants, or a chosen variant) commits to searchParams and advances
  // the wizard. Committing on every intermediate click used to read as "it
  // took me somewhere else" even though it was still step 2.
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  // Ubicación and Pago are the only steps with more than one field to fill,
  // so they're the only ones gated behind an explicit "Siguiente" instead of
  // auto-advancing on the first choice. A deep link that already carries
  // locationId (from a service/artist card) skips the location step
  // entirely, exactly like before — so it starts "done".
  const [locationStepDone, setLocationStepDone] = useState(() => !!searchParams.get("locationId"));
  const [paymentStepDone, setPaymentStepDone] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined);
  const [profilePhone, setProfilePhone] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [homeService, setHomeService] = useState(false);
  const [homeAddress, setHomeAddress] = useState("");
  const [homeZoneId, setHomeZoneId] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The booking flow now presents as a drawer over the salon's page rather
  // than a bare full-page wizard. It opens the instant this route mounts;
  // closing it (X, swipe-down, outside click, Escape) waits for the close
  // animation to finish before navigating home, so the slide-down isn't cut
  // short by an immediate route change.
  const [drawerOpen, setDrawerOpen] = useState(true);
  function handleDrawerOpenChangeComplete(nextOpen: boolean) {
    if (!nextOpen) router.push(`/salon/${salon.slug}`);
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      setUserEmail(data.user?.email ?? null);
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", data.user.id)
        .maybeSingle();
      setProfilePhone(profile?.phone ?? null);
    });
  }, []);

  function setParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`?${params.toString()}`);
  }

  // Single-location salons still land on the Ubicación step (it also hosts
  // the home-service choice now) but arrive with their one location
  // pre-selected so a click isn't wasted re-picking it.
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

  function homeServiceError(): string | null {
    if (!homeService) return null;
    if (!homeAddress.trim() || !homeZoneId) {
      return "La dirección y la zona son obligatorias para el servicio a domicilio.";
    }
    return null;
  }

  async function handleConfirm() {
    if (!locationId || !serviceId || !preference || !startsAt) return;
    const needsPhone = !profilePhone && !phoneInput.trim();
    if (needsPhone) {
      setError("El celular es obligatorio.");
      return;
    }
    const homeError = homeServiceError();
    if (homeError) {
      setError(homeError);
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      if (!profilePhone && phoneInput.trim()) {
        await updateMyPhone(phoneInput.trim());
      }
      await confirmBooking({
        salonId: salon.id,
        locationId,
        serviceId,
        variantId: variantId || null,
        artistPreference: preference,
        salonMembershipId: preference === "specific" ? artistId : null,
        startsAt,
        isHomeService: homeService,
        homeServiceAddress: homeService ? homeAddress.trim() : null,
        homeServiceZoneId: homeService ? homeZoneId : null,
        paymentMethod,
        paymentDetail: paymentDetail || null,
        rescheduleToken,
      });
      toast.success("Reserva enviada", {
        description: "Te confirmaremos por correo en breve.",
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
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onOpenChangeComplete={handleDrawerOpenChangeComplete}
        swipeDirection="down"
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader className="flex-row items-center justify-between">
            <DrawerTitle>{salon.name}</DrawerTitle>
            <DrawerClose
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <XIcon />
              <span className="sr-only">Cerrar</span>
            </DrawerClose>
          </DrawerHeader>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-6 pb-10 text-center">
            <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
              Reserva enviada
            </p>
            <h1 className="font-heading text-3xl text-foreground">¡Listo!</h1>
            <p className="max-w-md font-sans text-sm text-muted-foreground">
              Te confirmaremos por correo a {userEmail}. Revisa el estado de tu cita en tu
              cuenta.
            </p>
            <Link href={`/salon/${salon.slug}/account`} className={buttonVariants({ className: "mt-2" })}>
              Ir a mi cuenta
            </Link>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Step sequence and the URL param whose absence gates entry into each one
  // (waterfall — the first ungated step wins):
  //
  //   ubicacion -> servicio -> artista -> fecha -> hora -> pago -> confirmar
  //       |            |           |         |        |       |
  //  locationId    serviceId   preference   date   startsAt paymentStepDone
  //  (+locationStepDone) (+variantId
  //                       if needsVariant)
  //
  // resolveGoBackTarget (lib/domain/booking-navigation.ts) encodes the
  // reverse of this table — see the comment there for why each branch
  // clears the PREVIOUS step's field, not the current one.
  const currentStep: Step = !locationId || !locationStepDone
    ? "ubicacion"
    : !serviceId || needsVariant
      ? "servicio"
      : !preference
        ? "artista"
        : !date
          ? "fecha"
          : !startsAt
            ? "hora"
            : !paymentStepDone
              ? "pago"
              : "confirmar";

  function goBack() {
    const target = resolveGoBackTarget(currentStep, needsVariant);
    if (!target) {
      console.warn(`goBack(): unrecognized step "${currentStep}" — no navigation action taken.`);
      return;
    }
    if (target.kind === "navigate-home") {
      router.push(`/salon/${salon.slug}`);
      return;
    }
    if (target.sideEffects?.resetPaymentStepDone) setPaymentStepDone(false);
    if (target.sideEffects?.expandCurrentService) setExpandedServiceId(serviceId);
    if (target.sideEffects?.resetLocationStepDone) setLocationStepDone(false);
    const cleared: Record<string, null> = {};
    for (const param of target.params) cleared[param] = null;
    setParams(cleared);
  }

  // Only Ubicación and Pago use the built-in Next — every other step
  // auto-advances the instant a valid choice is made, so this only ever
  // fires from those two.
  function handleItemChange() {
    if (currentStep === "ubicacion") setLocationStepDone(true);
    if (currentStep === "pago") setPaymentStepDone(true);
  }

  const whenText = startsAt
    ? (() => {
        const dt = DateTime.fromISO(startsAt).setZone(salon.timezone).setLocale("es");
        return `${capitalize(dt.toFormat("cccc"))} ${dt.toFormat("d")} ${capitalize(
          dt.toFormat("LLLL")
        )}, ${dt.toFormat("HH:mm")}`;
      })()
    : "";

  const selectedVariant = variantId ? serviceVariants.find((v) => v.id === variantId) ?? null : null;
  const selectedZone = homeZoneId ? homeServiceZones.find((z) => z.id === homeZoneId) ?? null : null;
  const totalPrice = selectedService
    ? computeBookingPrice(selectedService, selectedVariant, homeService, selectedZone)
    : null;

  return (
    <Drawer
      open={drawerOpen}
      onOpenChange={setDrawerOpen}
      onOpenChangeComplete={handleDrawerOpenChangeComplete}
      swipeDirection="down"
      showSwipeHandle
    >
      <DrawerContent>
        <DrawerHeader className="flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Volver
          </button>
          <DrawerTitle className="sr-only">{salon.name}</DrawerTitle>
          <DrawerClose
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <XIcon />
            <span className="sr-only">Cerrar</span>
          </DrawerClose>
        </DrawerHeader>

        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto px-6 pb-10">
          <Questionnaire item={currentStep} onItemChange={handleItemChange}>
            <QuestionnaireProgress />

        {/* Ubicación: choosing a sede plus (new) whether to book at-home. */}
        <QuestionnaireItem name="ubicacion">
          <QuestionnaireTitle>Elige una ubicación</QuestionnaireTitle>
          {/* Plain buttons with manual radio ARIA, not shadcn RadioGroup — with
              4 RadioGroup instances mounted simultaneously (Questionnaire
              renders every step's DOM at once, not just the active one),
              base-ui's onValueChange stops firing for ALL of them, including
              the time-picker's previously-working one. Verified live:
              removing this from RadioGroup restored time-picker's clicks.
              Same bug class HANDOVER.md §8 already documents for Menu/
              Questionnaire-choices/Accordion — just a new trigger condition
              (multiple simultaneous instances, not a single broken component). */}
          <div role="radiogroup" className="flex flex-col gap-2">
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                role="radio"
                aria-checked={locationId === loc.id}
                onClick={() => setParams({ locationId: loc.id, preference: null, artistId: null })}
                className={cn(
                  "w-full rounded-md border px-4 py-3 text-left font-sans text-sm hover:border-gold",
                  locationId === loc.id ? "border-gold bg-gold/5" : "border-border"
                )}
              >
                <span className="text-foreground">{loc.name}</span>
                {loc.address && <span className="block text-muted-foreground">{loc.address}</span>}
              </button>
            ))}
          </div>
          <HomeServiceSection
            enabled={homeService}
            address={homeAddress}
            zoneId={homeZoneId}
            zones={homeServiceZones}
            onToggle={setHomeService}
            onAddressChange={setHomeAddress}
            onZoneChange={setHomeZoneId}
          />
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              disabled={!locationId || !!homeServiceError()}
              onClick={() => setLocationStepDone(true)}
              className="w-fit px-8"
            >
              Siguiente
            </Button>
            {locationId && homeServiceError() && (
              <p className="font-sans text-xs text-destructive">{homeServiceError()}</p>
            )}
          </div>
        </QuestionnaireItem>

        {/* Servicio: deep-link entry shows just one service's variants; the
            general case is an accordion of every service. */}
        <QuestionnaireItem name="servicio">
          {needsVariant && selectedService ? (
            <div className="flex flex-col gap-6">
              <QuestionnaireTitle>{selectedService.name}</QuestionnaireTitle>
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
          ) : (
            <div className="flex flex-col gap-6">
              <QuestionnaireTitle>Servicios</QuestionnaireTitle>
              <ul className="divide-y divide-border rounded-md border border-border">
                {services.map((s) => {
                  const isServiceExpanded = expandedServiceId === s.id;
                  const sVariants = variants.filter((v) => v.service_id === s.id);
                  return (
                    <li key={s.id} className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedServiceId(isServiceExpanded ? null : s.id)}
                        className="flex w-full items-center justify-between text-left font-sans text-sm"
                      >
                        <span className="text-foreground">{s.name}</span>
                        <span className="text-muted-foreground">
                          {s.has_variants
                            ? isServiceExpanded
                              ? "–"
                              : `${sVariants.length} opciones`
                            : `$${s.base_price} · ${s.base_duration_minutes} min`}
                        </span>
                      </button>
                      {isServiceExpanded && (
                        <div className="mt-2 flex flex-col gap-2 border-l border-border pl-4">
                          {s.has_variants ? (
                            sVariants.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => setParams({ serviceId: s.id, variantId: v.id })}
                                className="w-full rounded-md border border-border px-4 py-3 text-left font-sans text-sm hover:border-gold"
                              >
                                <span className="text-foreground">{v.name}</span>{" "}
                                <span className="text-muted-foreground">
                                  ${v.price} · {v.duration_minutes} min
                                </span>
                              </button>
                            ))
                          ) : (
                            <button
                              type="button"
                              onClick={() => setParams({ serviceId: s.id, variantId: null })}
                              className="w-full rounded-md border border-border px-4 py-3 text-left font-sans text-sm hover:border-gold"
                            >
                              <span className="text-foreground">Seleccionar</span>{" "}
                              <span className="text-muted-foreground">
                                ${s.base_price} · {s.base_duration_minutes} min
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </QuestionnaireItem>

        {/* Artista: "Cualquiera disponible" fija primero, luego cada
            estilista con foto — reusa el patrón null-safe de
            artists-section.tsx (fallback a un bloque muted, no un ícono
            genérico) para quienes aún no tienen headshot_url. Plain buttons
            with manual radio ARIA, not RadioGroup — see the comment on the
            Ubicación step above for why. */}
        <QuestionnaireItem name="artista">
          <QuestionnaireTitle>¿Con quién?</QuestionnaireTitle>
          <div role="radiogroup" className="flex flex-col gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={preference === "any"}
              onClick={() => setParams({ preference: "any", artistId: null })}
              className={cn(
                "flex w-full items-center rounded-md border px-4 py-3 text-left font-sans text-sm hover:border-gold",
                preference === "any" ? "border-gold bg-gold/5" : "border-border"
              )}
            >
              Cualquier artista disponible
            </button>
            {locationArtists.map((a) => (
              <button
                key={a.salon_membership_id}
                type="button"
                role="radio"
                aria-checked={preference === "specific" && artistId === a.salon_membership_id}
                onClick={() => setParams({ preference: "specific", artistId: a.salon_membership_id })}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left font-sans text-sm hover:border-gold",
                  preference === "specific" && artistId === a.salon_membership_id
                    ? "border-gold bg-gold/5"
                    : "border-border"
                )}
              >
                {a.headshot_url ? (
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-sm">
                    <Image
                      src={a.headshot_url}
                      alt={a.display_name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="size-14 shrink-0 rounded-sm bg-muted" />
                )}
                <div>
                  <span className="text-foreground">{a.display_name}</span>
                  {a.bio && <span className="block text-muted-foreground">{a.bio}</span>}
                </div>
              </button>
            ))}
          </div>
        </QuestionnaireItem>

        {/* Fecha: shadcn Calendar */}
        <QuestionnaireItem name="fecha">
          <QuestionnaireTitle>Elige una fecha</QuestionnaireTitle>
          <Calendar
            mode="single"
            selected={date ? DateTime.fromISO(date).toJSDate() : undefined}
            onSelect={(d) => d && setParams({ date: DateTime.fromJSDate(d).toISODate() })}
            disabled={{ before: DateTime.now().setZone(salon.timezone).toJSDate() }}
            className="rounded-md border border-border"
          />
        </QuestionnaireItem>

        {/* Hora: RadioGroup grid (replaces the old carousel + analog clock) */}
        <QuestionnaireItem name="hora">
          <QuestionnaireTitle>Elige un horario</QuestionnaireTitle>
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
        </QuestionnaireItem>

        {/* Pago: método + detalle, solo scaffolding — no cobra nada */}
        <QuestionnaireItem name="pago">
          <PaymentStep
            method={paymentMethod}
            detail={paymentDetail}
            onChange={(method, detail) => setParams({ paymentMethod: method, paymentDetail: detail || null })}
          />
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              disabled={!paymentMethod || (paymentMethod === "transferencia" && !paymentDetail)}
              onClick={() => setPaymentStepDone(true)}
              className="w-fit px-8"
            >
              Siguiente
            </Button>
            {paymentMethod === "transferencia" && !paymentDetail && (
              <p className="font-sans text-xs text-destructive">
                Elige Llave Bre-B o Nequi para continuar.
              </p>
            )}
          </div>
        </QuestionnaireItem>

        {/* Confirmar: resumen + login/celular + enviar */}
        <QuestionnaireItem name="confirmar">
          <div className="flex flex-col gap-6">
            <QuestionnaireTitle>Confirmar</QuestionnaireTitle>
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
              {homeService && (
                <p>
                  <span className="text-muted-foreground">Domicilio:</span>{" "}
                  {homeAddress} — {homeServiceZones.find((z) => z.id === homeZoneId)?.name}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Pago:</span>{" "}
                {paymentMethod === "pse" && "PSE"}
                {paymentMethod === "transferencia" &&
                  `Transferencia — ${paymentDetail === "nequi" ? "Nequi" : "Llave Bre-B"}`}
                {paymentMethod === "efectivo" && "Efectivo"}
              </p>
              {totalPrice != null && (
                <p className="mt-2 border-t border-border pt-2 font-mono text-base text-gold">
                  ${totalPrice.toLocaleString("es-CO")}
                  {homeService && selectedZone && (
                    <span className="ml-2 font-sans text-xs text-muted-foreground">
                      (incluye recargo domicilio {selectedZone.name})
                    </span>
                  )}
                </p>
              )}
            </div>

            {userEmail === undefined ? null : userEmail ? (
              <>
                <div className="rounded-md border border-border p-4">
                  <p className="font-sans text-xs tracking-[0.2em] text-muted-foreground uppercase">
                    Confirmación por correo
                  </p>
                  <p className="mt-1 font-sans text-sm text-foreground">
                    Te enviaremos la confirmación, con el enlace para reagendar o cancelar, a{" "}
                    <span className="text-gold">{userEmail}</span>.
                  </p>
                  {!profilePhone && (
                    <div className="mt-3 flex flex-col gap-1">
                      <label className="font-sans text-xs text-muted-foreground">
                        Celular (obligatorio)
                      </label>
                      <input
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="+57 300 000 0000"
                        className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  )}
                </div>

                {error && <p className="font-sans text-sm text-destructive">{error}</p>}

                <Button onClick={handleConfirm} disabled={confirming} size="lg" className="w-fit px-8">
                  {confirming && <Spinner />}
                  {confirming ? "Confirmando…" : "CONFIRMAR CITA"}
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-3 rounded-md border border-border p-4">
                <p className="font-sans text-xs tracking-[0.2em] text-muted-foreground uppercase">
                  Cuenta requerida
                </p>
                <p className="font-sans text-sm text-foreground">
                  Para reservar necesitas iniciar sesión — así podemos enviarte la
                  confirmación y dejarte reagendar o cancelar desde tu cuenta.
                </p>
                <p className="font-sans text-sm text-gold">
                  ✓ Tu selección queda guardada — inicia sesión y vuelves directo aquí.
                </p>
                <Link
                  href={`/auth/login?next=${encodeURIComponent(
                    `/salon/${salon.slug}/book?${searchParams.toString()}`
                  )}`}
                  className={buttonVariants({ size: "lg", className: "w-fit px-8" })}
                >
                  Iniciar sesión para continuar
                </Link>
              </div>
            )}
          </div>
        </QuestionnaireItem>
          </Questionnaire>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
