import type { Salon } from "@/lib/tenant/resolve-salon";
import { CareersSection } from "./careers-section";

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

export function SiteFooter({ salon }: { salon: Salon }) {
  const socialLinks =
    salon.social_links && typeof salon.social_links === "object" && !Array.isArray(salon.social_links)
      ? Object.entries(salon.social_links as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0
        )
      : [];

  return (
    <footer className="flex flex-col gap-10 px-6 py-16 sm:px-10">
      <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
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
        <CareersSection salon={salon} />
        <p className="font-sans text-xs text-muted-foreground">
          {salon.footer_text ?? `© ${salon.name}`}
        </p>
      </div>

      {socialLinks.length > 0 && (
        <div className="flex justify-center gap-6 border-t border-border pt-8">
          {socialLinks.map(([key, url]) => (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-xs tracking-wide text-muted-foreground uppercase hover:text-foreground"
            >
              {SOCIAL_LABELS[key] ?? key}
            </a>
          ))}
        </div>
      )}
    </footer>
  );
}
