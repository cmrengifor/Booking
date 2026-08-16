import { getCurrentProfile } from "@/lib/auth/session";

export default async function AccountPage() {
  const profile = await getCurrentProfile();

  return (
    <div className="p-8">
      <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
        Mi cuenta
      </p>
      <h1 className="mt-2 font-heading text-3xl text-foreground">
        {profile?.full_name ?? "Cliente"}
      </h1>
      <p className="mt-2 font-sans text-sm text-muted-foreground">
        Próximas citas, historial, reagendar y cancelar llegan en la Fase 6.
      </p>
    </div>
  );
}
