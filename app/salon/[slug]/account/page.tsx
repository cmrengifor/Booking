import { DateTime } from "luxon";
import Link from "next/link";
import { getCurrentProfile, getSalonMembership, isPlatformAdmin } from "@/lib/auth/session";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { BookingTrigger } from "@/components/public-site/booking-trigger";
import { presetIdForAvatarUrl } from "@/lib/avatars";
import { cancelMyAppointment, signOut, submitReview, updateProfile } from "./actions";
import { PhoneInput } from "./phone-input";
import { AvatarPickerSection } from "./avatar-picker-section";

const STATUS_LABELS: Record<string, string> = {
  open: "Buscando artista",
  pending: "Esperando confirmación",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

export default async function AccountPage({
  params,
}: PageProps<"/salon/[slug]/account">) {
  const { slug } = await params;
  const supabase = await createClient();

  const [salon, profile] = await Promise.all([
    resolveSalonBySlug(slug),
    getCurrentProfile(),
  ]);
  if (!salon) return null;

  const [{ data: customer }, { count: unread }] = await Promise.all([
    supabase
      .from("customers")
      .select("id")
      .eq("salon_id", salon.id)
      .eq("profile_id", profile!.id)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_profile_id", profile!.id)
      .is("read_at", null),
  ]);

  const { data: appointments } = customer
    ? await supabase
        .from("appointments")
        .select(
          "id, status, starts_at, ends_at, price, salon_membership_id, services(name), service_variants(name)"
        )
        .eq("customer_id", customer.id)
        .order("starts_at", { ascending: false })
    : { data: [] };

  // Artist names are fetched separately, via artist_profiles (public for
  // published rows) rather than a nested salon_memberships(...) embed —
  // salon_memberships itself isn't readable by a customer under RLS (only
  // the member themselves, staff, or a platform admin), so the embed
  // silently came back null and every specific-artist appointment showed
  // as "Cualquier artista".
  const membershipIds = Array.from(
    new Set((appointments ?? []).map((a) => a.salon_membership_id).filter((id): id is string => !!id))
  );
  const { data: artistProfiles } = membershipIds.length
    ? await supabase
        .from("artist_profiles")
        .select("salon_membership_id, display_name")
        .in("salon_membership_id", membershipIds)
    : { data: [] };
  const artistNameByMembership = new Map(
    (artistProfiles ?? []).map((a) => [a.salon_membership_id, a.display_name])
  );

  const nowIso = DateTime.now().toISO();
  const upcoming = (appointments ?? []).filter(
    (a) => ["open", "pending", "confirmed"].includes(a.status) && a.starts_at >= nowIso!
  );
  const history = (appointments ?? []).filter((a) => !upcoming.includes(a));

  const completedIds = history.filter((a) => a.status === "completed").map((a) => a.id);
  const { data: reviews } = completedIds.length
    ? await supabase.from("reviews").select("appointment_id, rating").in("appointment_id", completedIds)
    : { data: [] };
  const reviewedIds = new Set((reviews ?? []).map((r) => r.appointment_id));

  const [membership, platformAdmin] = await Promise.all([
    getSalonMembership(salon.id),
    isPlatformAdmin(),
  ]);

  const updateProfileAction = updateProfile.bind(null, slug);
  const signOutAction = signOut.bind(null, slug);

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
            Mi cuenta
          </p>
          <h1 className="mt-2 font-heading text-3xl text-foreground">
            {profile?.full_name || "Cliente"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <BookingTrigger className={buttonVariants({ size: "sm" })}>
            Reservar ahora
          </BookingTrigger>
          {membership && (
            <Link
              href={`/salon/${slug}/admin`}
              className="font-sans text-sm text-gold hover:text-foreground"
            >
              Panel del salón
            </Link>
          )}
          {platformAdmin && (
            <Link
              href="/platform-admin"
              className="font-sans text-sm text-gold hover:text-foreground"
            >
              Plataforma
            </Link>
          )}
          <Link
            href={`/salon/${slug}/notifications`}
            className="font-sans text-sm text-muted-foreground hover:text-foreground"
          >
            Notificaciones{unread ? ` (${unread})` : ""}
          </Link>
          <form action={signOutAction}>
            <Button variant="ghost" size="sm" type="submit">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <form
          action={updateProfileAction}
          className="flex max-w-sm flex-1 flex-col gap-3 rounded-md border border-border p-4"
        >
          <h2 className="font-sans text-sm font-medium text-foreground">Perfil</h2>
          <input
            name="full_name"
            defaultValue={profile?.full_name ?? ""}
            placeholder="Nombre completo"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <PhoneInput name="phone" defaultValue={profile?.phone ?? ""} />
          <Button type="submit" size="sm">
            Guardar
          </Button>
        </form>

        <AvatarPickerSection slug={slug} initialSelectedId={presetIdForAvatarUrl(profile?.avatar_url)} />
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Próximas citas</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {upcoming.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3 font-sans text-sm"
            >
              <div>
                <p className="text-foreground">
                  {a.services?.name}
                  {a.service_variants?.name && ` — ${a.service_variants.name}`}
                </p>
                <p className="text-muted-foreground">
                  {DateTime.fromISO(a.starts_at)
                    .setZone(salon.timezone)
                    .setLocale("es")
                    .toFormat("cccc d LLLL, HH:mm")}{" "}
                  · {(a.salon_membership_id && artistNameByMembership.get(a.salon_membership_id)) ?? "Cualquier artista"}{" "}
                  · {STATUS_LABELS[a.status]}
                </p>
              </div>
              {a.status !== "open" && (
                <div className="flex gap-2">
                  <Link
                    href={`/salon/${slug}/account/appointments/${a.id}/reschedule`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Reagendar
                  </Link>
                  <form action={cancelMyAppointment.bind(null, a.id, slug)}>
                    <Button variant="outline" size="sm" type="submit">
                      Cancelar
                    </Button>
                  </form>
                </div>
              )}
            </li>
          ))}
          {!upcoming.length && (
            <p className="font-sans text-sm text-muted-foreground">
              No tienes citas próximas.
            </p>
          )}
        </ul>
      </div>

      <div>
        <h2 className="font-heading text-lg text-foreground">Historial</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {history.map((a) => (
            <li
              key={a.id}
              className="rounded-md bg-muted/40 px-4 py-3 font-sans text-sm text-muted-foreground"
            >
              {a.services?.name}
              {a.service_variants?.name && ` — ${a.service_variants.name}`} ·{" "}
              {DateTime.fromISO(a.starts_at).setZone(salon.timezone).setLocale("es").toFormat("d LLL yyyy")} ·{" "}
              {STATUS_LABELS[a.status]}
              {a.status === "completed" &&
                (reviewedIds.has(a.id) ? (
                  <span className="ml-2 text-gold">· Reseña enviada</span>
                ) : (
                  <form
                    action={submitReview.bind(null, a.id, slug)}
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <select
                      name="rating"
                      required
                      defaultValue=""
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="" disabled>Calificación…</option>
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {"★".repeat(n)}
                        </option>
                      ))}
                    </select>
                    <input
                      name="comment"
                      placeholder="Comentario (opcional)"
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button size="xs" type="submit">
                      Enviar reseña
                    </Button>
                  </form>
                ))}
            </li>
          ))}
          {!history.length && (
            <p className="font-sans text-sm text-muted-foreground">Sin historial todavía.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
