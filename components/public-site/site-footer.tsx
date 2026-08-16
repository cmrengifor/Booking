import type { Salon } from "@/lib/tenant/resolve-salon";
import { getSocialLinks, SOCIAL_LABELS } from "@/lib/social-links";
import { CareersSection } from "./careers-section";
import { NewsletterSection } from "./newsletter-section";

export function SiteFooter({ salon }: { salon: Salon }) {
  const socialLinks = getSocialLinks(salon);

  return (
    <footer className="flex flex-col gap-10 px-6 py-16 sm:px-10">
      <div className="flex flex-col gap-10 sm:flex-row sm:items-end sm:justify-between">
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
        <NewsletterSection salon={salon} />
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
