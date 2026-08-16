import { DateTime } from "luxon";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getSalonMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  acceptPending,
  complete,
  declinePending,
  noShow,
  release,
  staffCancel,
  takeOpenAppointment,
} from "./actions";

export default async function AdminAppointmentsPage({
  params,
}: PageProps<"/salon/[slug]/admin/appointments">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const membership = await getSalonMembership(salon.id);
  const supabase = await createClient();

  const [{ data: appointments }, { data: stylists }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, status, starts_at, price, salon_membership_id, customers(profiles(full_name)), services(name), service_variants(name), salon_memberships(artist_profiles(display_name))"
      )
      .in("status", ["open", "pending", "confirmed"])
      .order("starts_at"),
    supabase
      .from("salon_memberships")
      .select("id, artist_profiles(display_name)")
      .eq("salon_id", salon.id)
      .eq("role", "stylist")
      .eq("status", "active"),
  ]);

  const open = (appointments ?? []).filter((a) => a.status === "open");
  const pending = (appointments ?? []).filter((a) => a.status === "pending");
  const confirmed = (appointments ?? []).filter((a) => a.status === "confirmed");
  const isStylist = membership?.role === "stylist";

  function fmt(a: { starts_at: string }) {
    return DateTime.fromISO(a.starts_at).setZone(salon!.timezone).setLocale("es").toFormat("d LLL, HH:mm");
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Panel del salón
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">Citas</h1>
      </div>

      <Section title={`Abiertas (${open.length})`}>
        {open.map((a) => (
          <li key={a.id} className="rounded-md border border-border px-4 py-3 font-sans text-sm">
            <p className="text-foreground">
              {a.services?.name}
              {a.service_variants?.name && ` — ${a.service_variants.name}`} · {fmt(a)}
            </p>
            <p className="text-muted-foreground">{a.customers?.profiles?.full_name}</p>
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
      </Section>

      <Section title={`Pendientes de confirmación (${pending.length})`}>
        {pending.map((a) => (
          <li key={a.id} className="rounded-md border border-border px-4 py-3 font-sans text-sm">
            <p className="text-foreground">
              {a.services?.name}
              {a.service_variants?.name && ` — ${a.service_variants.name}`} · {fmt(a)}
            </p>
            <p className="text-muted-foreground">
              {a.customers?.profiles?.full_name} ·{" "}
              {a.salon_memberships?.artist_profiles?.display_name}
            </p>
            {/* accept_pending_appointment/decline_pending_appointment only
                authorize the assigned artist themselves or rec/mgr/owner —
                a stylist looking at a teammate's pending request has no
                authorization, so hide the buttons rather than let them fail. */}
            {(!isStylist || a.salon_membership_id === membership?.id) && (
              <div className="mt-2 flex gap-2">
                <form action={acceptPending.bind(null, a.id, slug)}>
                  <Button size="sm" type="submit">Aceptar</Button>
                </form>
                <form action={declinePending.bind(null, a.id, slug)}>
                  <Button size="sm" variant="outline" type="submit">Rechazar</Button>
                </form>
              </div>
            )}
          </li>
        ))}
        {!pending.length && <Empty />}
      </Section>

      <Section title={`Confirmadas (${confirmed.length})`}>
        {confirmed.map((a) => (
          <li key={a.id} className="rounded-md border border-border px-4 py-3 font-sans text-sm">
            <p className="text-foreground">
              {a.services?.name}
              {a.service_variants?.name && ` — ${a.service_variants.name}`} · {fmt(a)}
            </p>
            <p className="text-muted-foreground">
              {a.customers?.profiles?.full_name} ·{" "}
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
                    <Button size="sm" type="submit">Completar</Button>
                  </form>
                  <form action={noShow.bind(null, a.id, slug)}>
                    <Button size="sm" variant="outline" type="submit">No asistió</Button>
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
                  <Button size="sm" variant="ghost" type="submit">Cancelar</Button>
                </form>
              )}
            </div>
          </li>
        ))}
        {!confirmed.length && <Empty />}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-heading text-lg text-foreground">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">{children}</ul>
    </div>
  );
}

function Empty() {
  return <p className="font-sans text-sm text-muted-foreground">Nada aquí.</p>;
}
