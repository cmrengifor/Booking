import type { Salon } from "@/lib/tenant/resolve-salon";

export function SiteFooter({ salon }: { salon: Salon }) {
  return (
    <footer className="flex flex-col gap-6 px-6 py-16 sm:flex-row sm:items-end sm:justify-between sm:px-10">
      <div>
        <p className="font-heading text-xl italic text-foreground">{salon.name}</p>
        {salon.address && (
          <p className="mt-2 font-sans text-sm text-muted-foreground">{salon.address}</p>
        )}
        {salon.contact_phone && (
          <p className="font-sans text-sm text-muted-foreground">{salon.contact_phone}</p>
        )}
        {salon.contact_email && (
          <p className="font-sans text-sm text-muted-foreground">{salon.contact_email}</p>
        )}
      </div>
      <p className="font-sans text-xs text-muted-foreground">
        {salon.footer_text ?? `© ${salon.name}`}
      </p>
    </footer>
  );
}
