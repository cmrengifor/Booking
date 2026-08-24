import { DateTime } from "luxon";
import Link from "next/link";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getSalonMembership } from "@/lib/auth/session";
import { canViewAllAppointments } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { assertNoQueryErrors } from "@/lib/supabase/assert";
import { Button } from "@/components/ui/button";
import { TriggerActionButton } from "./trigger-action-button";
import { DeclineForm } from "./decline-form";
import { CollapsibleSection } from "./collapsible-section";
import { CalendarView } from "./calendar-view";
import {
  acceptPending,
  complete,
  noShow,
  release,
  staffCancel,
  takeOpenAppointment,
  triggerNpsSurvey,
  triggerRescheduleFollowup,
} from "./actions";

export default async function AdminAppointmentsPage({
  params,
  searchParams,
}: PageProps<"/salon/[slug]/admin/appointments">) {
  const { slug } = await params;
  const sp = await searchParams;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const membership = await getSalonMembership(salon.id);
  const supabase = await createClient();

  // A stylist only sees their own assigned appointments — plus the
  // unassigned "open" pool, so self-claiming still works — and never sees
  // which customer they belong to (enforced below by simply never
  // rendering it, not by omitting it from the query — a Server Component's
  // fetched data never reaches the browser unless it's actually rendered).
  const restrictToOwn = !canViewAllAppointments(membership);
  const showCustomerName = canViewAllAppointments(membership);
  const isStylist = membership?.role === "stylist";
  const view = sp.view === "calendar" ? "calendar" : "list";

  if (view === "calendar") {
    const zone = salon.timezone;
    const today = DateTime.now().setZone(zone).toISODate()!;
    const requestedDate = typeof sp.date === "string" ? sp.date : null;
    const dateISO =
      requestedDate && DateTime.fromISO(requestedDate, { zone }).isValid ? requestedDate : today;
    const mode = sp.mode === "week" ? "week" : sp.mode === "month" ? "month" : "day";
    const canAssign = canViewAllAppointments(membership);

    const anchor = DateTime.fromISO(dateISO, { zone });
    const range =
      mode === "day"
        ? { start: anchor.startOf("day"), end: anchor.startOf("day").plus({ days: 1 }) }
        : mode === "week"
          ? { start: anchor.startOf("week"), end: anchor.startOf("week").plus({ days: 7 }) }
          : {
              start: anchor.startOf("month").startOf("week"),
              end: anchor.endOf("month").endOf("week").plus({ days: 1 }),
            };

    let rangeQuery = supabase
      .from("appointments")
      .select(
        "id, status, starts_at, ends_at, salon_membership_id, customers(profiles(full_name)), services(name), service_variants(name)"
      )
      .eq("salon_id", salon.id)
      .gte("starts_at", range.start.toISO())
      .lt("starts_at", range.end.toISO())
      .order("starts_at");
    if (restrictToOwn && membership) {
      rangeQuery = rangeQuery.or(`status.eq.open,salon_membership_id.eq.${membership.id}`);
    }

    const [rangeRes, stylistsRes, openPoolRes] = await Promise.all([
      rangeQuery,
      supabase
        .from("salon_memberships")
        .select("id, artist_profiles(display_name, headshot_url)")
        .eq("salon_id", salon.id)
        .eq("role", "stylist")
        .eq("status", "active"),
      // Salon-wide, not date-scoped — the assign panel is meant to surface
      // every outstanding unassigned booking, not just the ones landing in
      // whichever day/week/month happens to be on screen.
      canAssign
        ? supabase
            .from("appointments")
            .select("id, starts_at, ends_at, services(name), service_variants(name)")
            .eq("salon_id", salon.id)
            .eq("status", "open")
            .order("starts_at")
            .limit(30)
        : Promise.resolve({ data: [], error: null }),
    ]);
    assertNoQueryErrors([rangeRes, stylistsRes, openPoolRes], "Failed to load calendar");

    return (
      <div className="flex flex-col gap-8 p-8">
        <AppointmentsHeader slug={slug} view={view} />
        <CalendarView
          slug={slug}
          salon={salon}
          mode={mode}
          dateISO={dateISO}
          appointments={rangeRes.data ?? []}
          stylists={stylistsRes.data ?? []}
          openPool={openPoolRes.data ?? []}
          restrictToOwn={restrictToOwn}
          membershipId={membership?.id ?? null}
          isStylist={isStylist}
          showCustomerName={showCustomerName}
          canAssign={canAssign}
        />
      </div>
    );
  }

  let activeQuery = supabase
    .from("appointments")
    .select(
      "id, status, starts_at, price, salon_membership_id, customers(profiles(full_name)), services(name), service_variants(name), salon_memberships(artist_profiles(display_name))"
    )
    .eq("salon_id", salon.id)
    .in("status", ["open", "pending", "confirmed"]);
  if (restrictToOwn && membership) {
    activeQuery = activeQuery.or(`status.eq.open,salon_membership_id.eq.${membership.id}`);
  }

  let pastQuery = supabase
    .from("appointments")
    .select(
      "id, status, starts_at, price, amount_paid, cancellation_reason, salon_membership_id, customers(profiles(full_name)), services(name), service_variants(name), salon_memberships(artist_profiles(display_name))"
    )
    .eq("salon_id", salon.id)
    .in("status", ["completed", "cancelled", "no_show"]);
  if (restrictToOwn && membership) {
    pastQuery = pastQuery.eq("salon_membership_id", membership.id);
  }

  const [appointmentsRes, pastAppointmentsRes, stylistsRes] = await Promise.all([
    activeQuery.order("starts_at").limit(200),
    pastQuery.order("starts_at", { ascending: false }).limit(50),
    supabase
      .from("salon_memberships")
      .select("id, artist_profiles(display_name)")
      .eq("salon_id", salon.id)
      .eq("role", "stylist")
      .eq("status", "active"),
  ]);
  assertNoQueryErrors([appointmentsRes, pastAppointmentsRes, stylistsRes], "Failed to load appointments");
  const { data: appointments } = appointmentsRes;
  const { data: pastAppointments } = pastAppointmentsRes;
  const { data: stylists } = stylistsRes;

  const open = (appointments ?? []).filter((a) => a.status === "open");
  const pending = (appointments ?? []).filter((a) => a.status === "pending");
  const confirmed = (appointments ?? []).filter((a) => a.status === "confirmed");
  const completedList = (pastAppointments ?? []).filter((a) => a.status === "completed");
  const cancelledList = (pastAppointments ?? []).filter((a) => a.status === "cancelled");
  const noShowList = (pastAppointments ?? []).filter((a) => a.status === "no_show");

  function fmt(a: { starts_at: string }) {
    return DateTime.fromISO(a.starts_at).setZone(salon!.timezone).setLocale("es").toFormat("d LLL, HH:mm");
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      <AppointmentsHeader slug={slug} view={view} />

      <CollapsibleSection title={`Abiertas (${open.length})`}>
        {open.map((a) => (
          <li key={a.id} className="rounded-md border border-border px-4 py-3 font-sans text-sm">
            <p className="text-foreground">
              {a.services?.name}
              {a.service_variants?.name && ` — ${a.service_variants.name}`} · {fmt(a)}
            </p>
            {showCustomerName && (
              <p className="text-muted-foreground">{a.customers?.profiles?.full_name}</p>
            )}
            {isStylist ? (
              <form action={takeOpenAppointment.bind(null, a.id, null, slug)} className="mt-2">
                <Button size="sm" type="submit">Tomar</Button>
              </form>
            ) : (
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await takeOpenAppointment(a.id, String(formData.get("stylist")), slug);
                }}
                className="mt-2 flex gap-2"
              >
                <select
                  name="stylist"
                  required
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Asignar a…</option>
                  {stylists?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.artist_profiles?.display_name}
                    </option>
                  ))}
                </select>
                <Button size="sm" type="submit">Asignar</Button>
              </form>
            )}
          </li>
        ))}
        {!open.length && <Empty />}
      </CollapsibleSection>

      <CollapsibleSection title={`Pendientes de confirmación (${pending.length})`}>
        {pending.map((a) => (
          <li key={a.id} className="rounded-md border border-border px-4 py-3 font-sans text-sm">
            <p className="text-foreground">
              {a.services?.name}
              {a.service_variants?.name && ` — ${a.service_variants.name}`} · {fmt(a)}
            </p>
            <p className="text-muted-foreground">
              {showCustomerName && <>{a.customers?.profiles?.full_name} ·{" "}</>}
              {a.salon_memberships?.artist_profiles?.display_name}
            </p>
            {/* accept_pending_appointment/decline_pending_appointment only
                authorize the assigned artist themselves or rec/mgr/owner —
                a stylist looking at a teammate's pending request has no
                authorization, so hide the buttons rather than let them fail. */}
            {(!isStylist || a.salon_membership_id === membership?.id) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <form action={acceptPending.bind(null, a.id, slug)}>
                  <Button size="sm" variant="success" type="submit">Aceptar</Button>
                </form>
                <DeclineForm appointmentId={a.id} slug={slug} />
              </div>
            )}
          </li>
        ))}
        {!pending.length && <Empty />}
      </CollapsibleSection>

      <CollapsibleSection title={`Confirmadas (${confirmed.length})`}>
        {confirmed.map((a) => (
          <li key={a.id} className="rounded-md border border-border px-4 py-3 font-sans text-sm">
            <p className="text-foreground">
              {a.services?.name}
              {a.service_variants?.name && ` — ${a.service_variants.name}`} · {fmt(a)}
            </p>
            <p className="text-muted-foreground">
              {showCustomerName && <>{a.customers?.profiles?.full_name} ·{" "}</>}
              {a.salon_memberships?.artist_profiles?.display_name} · ${a.price}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* complete_appointment/mark_no_show/release_appointment only
                  authorize the assigned artist or rec/mgr/owner. */}
              {(!isStylist || a.salon_membership_id === membership?.id) && (
                <>
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      await complete(a.id, Number(formData.get("amount")), slug);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      defaultValue={a.price ?? undefined}
                      className="w-20 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button size="sm" variant="success" type="submit">Completar</Button>
                  </form>
                  <form action={noShow.bind(null, a.id, slug)}>
                    <Button size="sm" variant="warning" type="submit">No asistió</Button>
                  </form>
                  <form action={release.bind(null, a.id, slug)}>
                    <Button size="sm" variant="outline" type="submit">Liberar</Button>
                  </form>
                </>
              )}
              {/* cancel_appointment never authorizes a stylist, even for
                  their own appointment — only rec/mgr/owner. */}
              {!isStylist && (
                <form action={staffCancel.bind(null, a.id, slug)}>
                  <Button size="sm" variant="destructive" type="submit">Cancelar</Button>
                </form>
              )}
            </div>
          </li>
        ))}
        {!confirmed.length && <Empty />}
      </CollapsibleSection>

      <CollapsibleSection title={`Completadas (${completedList.length})`}>
        {completedList.map((a) => (
          <li key={a.id} className="rounded-md border border-border px-4 py-3 font-sans text-sm">
            <p className="text-foreground">
              {a.services?.name}
              {a.service_variants?.name && ` — ${a.service_variants.name}`} · {fmt(a)}
            </p>
            <p className="text-muted-foreground">
              {showCustomerName && <>{a.customers?.profiles?.full_name} ·{" "}</>}
              {a.salon_memberships?.artist_profiles?.display_name} · ${a.amount_paid ?? a.price}
            </p>
            <div className="mt-2">
              <TriggerActionButton
                action={triggerNpsSurvey}
                appointmentId={a.id}
                slug={slug}
                label="Enviar encuesta"
                variant="success"
              />
            </div>
          </li>
        ))}
        {!completedList.length && <Empty />}
      </CollapsibleSection>

      <CollapsibleSection title={`Canceladas (${cancelledList.length})`}>
        {cancelledList.map((a) => (
          <li key={a.id} className="rounded-md border border-border px-4 py-3 font-sans text-sm">
            <p className="text-foreground">
              {a.services?.name}
              {a.service_variants?.name && ` — ${a.service_variants.name}`} · {fmt(a)}
            </p>
            <p className="text-muted-foreground">
              {showCustomerName && a.customers?.profiles?.full_name}
              {a.cancellation_reason && ` · ${a.cancellation_reason}`}
            </p>
            <div className="mt-2">
              <TriggerActionButton
                action={triggerRescheduleFollowup}
                appointmentId={a.id}
                slug={slug}
                label="Hacer seguimiento"
                variant="destructive"
              />
            </div>
          </li>
        ))}
        {!cancelledList.length && <Empty />}
      </CollapsibleSection>

      <CollapsibleSection title={`No asistió (${noShowList.length})`}>
        {noShowList.map((a) => (
          <li key={a.id} className="rounded-md border border-border px-4 py-3 font-sans text-sm">
            <p className="text-foreground">
              {a.services?.name}
              {a.service_variants?.name && ` — ${a.service_variants.name}`} · {fmt(a)}
            </p>
            <p className="text-muted-foreground">
              {showCustomerName && <>{a.customers?.profiles?.full_name} ·{" "}</>}
              {a.salon_memberships?.artist_profiles?.display_name}
            </p>
          </li>
        ))}
        {!noShowList.length && <Empty />}
      </CollapsibleSection>
    </div>
  );
}

function Empty() {
  return <p className="font-sans text-sm text-muted-foreground">Nada aquí.</p>;
}

function AppointmentsHeader({ slug, view }: { slug: string; view: "list" | "calendar" }) {
  const base = `/salon/${slug}/admin/appointments`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">Panel del salón</p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">Citas</h1>
      </div>
      <div className="flex overflow-hidden rounded-md border border-border font-sans text-xs">
        <Link
          href={base}
          className={
            view === "list"
              ? "bg-primary px-3 py-1.5 text-primary-foreground"
              : "px-3 py-1.5 text-muted-foreground hover:text-foreground"
          }
        >
          Lista
        </Link>
        <Link
          href={`${base}?view=calendar`}
          className={
            view === "calendar"
              ? "bg-primary px-3 py-1.5 text-primary-foreground"
              : "px-3 py-1.5 text-muted-foreground hover:text-foreground"
          }
        >
          Calendario
        </Link>
      </div>
    </div>
  );
}
