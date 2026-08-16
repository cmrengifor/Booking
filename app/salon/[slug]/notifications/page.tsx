import { DateTime } from "luxon";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { markAllRead, markRead } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  booking_requested: "Solicitud enviada",
  booking_confirmed: "Reserva confirmada",
  booking_rejected: "Reserva no confirmada",
  appointment_rescheduled: "Cita reagendada",
  appointment_cancelled: "Cita cancelada",
  appointment_reminder: "Recordatorio",
  review_request: "Deja tu reseña",
  open_appointment_available: "Cita abierta disponible",
  appointment_assigned: "Nueva solicitud",
};

export default async function NotificationsPage({
  params,
}: PageProps<"/salon/[slug]/notifications">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const user = await getCurrentUser();
  if (!user) redirect(`/auth/login?next=/salon/${slug}/notifications`);

  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("salon_id", salon.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const markAllReadAction = markAllRead.bind(null, slug);

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
            {salon.name}
          </p>
          <h1 className="mt-2 font-heading text-3xl text-foreground">
            Notificaciones
          </h1>
        </div>
        <form action={markAllReadAction}>
          <Button variant="ghost" size="sm" type="submit">
            Marcar todo como leído
          </Button>
        </form>
      </div>

      <ul className="flex flex-col gap-2">
        {notifications?.map((n) => (
          <li
            key={n.id}
            className={`flex items-center justify-between rounded-md border px-4 py-3 font-sans text-sm ${
              n.read_at ? "border-border" : "border-gold bg-gold/5"
            }`}
          >
            <div>
              <p className="text-foreground">
                {TYPE_LABELS[n.type] ?? n.title}
              </p>
              <p className="text-muted-foreground">
                {n.body} ·{" "}
                {DateTime.fromISO(n.created_at)
                  .setZone(salon.timezone)
                  .setLocale("es")
                  .toFormat("d LLL, HH:mm")}
              </p>
            </div>
            {!n.read_at && (
              <form action={markRead.bind(null, n.id, slug)}>
                <Button variant="ghost" size="xs" type="submit">
                  Marcar leído
                </Button>
              </form>
            )}
          </li>
        ))}
        {!notifications?.length && (
          <p className="font-sans text-sm text-muted-foreground">
            Sin notificaciones todavía.
          </p>
        )}
      </ul>
    </div>
  );
}
