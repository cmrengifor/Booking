import type { Salon } from "@/lib/tenant/resolve-salon";

export const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

export function getSocialLinks(salon: Salon): [string, string][] {
  if (
    !salon.social_links ||
    typeof salon.social_links !== "object" ||
    Array.isArray(salon.social_links)
  ) {
    return [];
  }
  return Object.entries(salon.social_links as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0
  );
}
