import { DateTime } from "luxon";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/session";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { cancelMyAppointment, signOut, updateProfile } from "./actions";

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
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("salon_id", salon.id)
    .eq("profile_id", profile!.id)
    .maybeSingle();

  const { data: appointments } = customer
    ? await supabase
        .from("appointments")
        .select(
          "id, status, starts_at, ends_at, price, services(name), service_variants(name), salon_memberships(artist_profiles(display_name))"
        )
        .eq("customer_id", customer.id)
        .order("starts_at", { ascending: false })
    : { data: [] };

  const nowIso = DateTime.now().toISO();
  const upcoming = (appointments ?? []).filter(
    (a) => ["open", "pending", "confirmed"].includes(a.status) && a.starts_at >= nowIso!
  );
  const history = (appointments ?? []).filter((a) => !upcoming.includes(a));

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
        <form action={signOutAction}>
          <Button variant="ghost" size="sm" type="submit">
            Cerrar sesión
          </Button>
        </form>
      </div>

      <form
        action={updateProfileAction}
        className="flex max-w-sm flex-col gap-3 rounded-md border border-border p-4"
      >
        <h2 className="font-sans text-sm font-medium text-foreground">Perfil</h2>
        <input
          name="full_name"
          defaultValue={profile?.full_name ?? ""}
          placeholder="Nombre completo"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          name="phone"
          defaultValue={profile?.phone ?? ""}
          placeholder="Teléfono"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" size="sm">
          Guardar
        </Button>
      </form>

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
                    .toFormat("cccc d LLLL, HH:mm")}{" "}
                  · {a.salon_memberships?.artist_profiles?.display_name ?? "Cualquier artista"}{" "}
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
              {DateTime.fromISO(a.starts_at).setZone(salon.timezone).toFormat("d LLL yyyy")} ·{" "}
              {STATUS_LABELS[a.status]}
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
