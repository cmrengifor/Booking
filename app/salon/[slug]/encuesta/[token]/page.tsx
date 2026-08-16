import { notFound } from "next/navigation";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteHeader } from "@/components/public-site/site-header";
import { SiteFooter } from "@/components/public-site/site-footer";
import { SurveyForm } from "./survey-form";

export default async function EncuestaTokenPage({
  params,
}: PageProps<"/salon/[slug]/encuesta/[token]">) {
  const { slug, token } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) notFound();

  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from("appointment_action_tokens")
    .select("id, expires_at, used_at")
    .eq("id", token)
    .eq("purpose", "nps_survey")
    .maybeSingle();

  const valid = !!tokenRow && !tokenRow.used_at && new Date(tokenRow.expires_at) > new Date();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader salon={salon} />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        {valid ? (
          <>
            <h1 className="font-heading text-2xl text-foreground">Tu opinión nos importa</h1>
            <p className="max-w-md font-sans text-sm text-muted-foreground">
              Gracias por confiar en {salon.name}. Solo te tomará un minuto.
            </p>
            <div className="mt-4">
              <SurveyForm token={tokenRow.id} />
            </div>
          </>
        ) : (
          <>
            <h1 className="font-heading text-2xl text-foreground">Este enlace ya no está activo</h1>
            <p className="max-w-md font-sans text-sm text-muted-foreground">
              Es posible que ya hayas respondido esta encuesta, o que el enlace haya expirado.
            </p>
          </>
        )}
      </div>
      <SiteFooter salon={salon} />
    </div>
  );
}
