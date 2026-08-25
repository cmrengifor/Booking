"use client";

import { useEffect, useState } from "react";
import { Copy, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import type { Salon } from "@/lib/tenant/resolve-salon";
import SocialButton from "@/components/kokonutui/social-button";

/** Generic message-bubble mark — not WhatsApp's trademarked glyph, just a
 *  recognizable "chat" stand-in for that channel, drawn in the same
 *  stroke style as the rest of the icon set. */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3a9 9 0 0 0-7.75 13.53L3 21l4.6-1.2A9 9 0 1 0 12 3Z" />
      <path d="M8.5 9.5c0 3.5 2.5 6 6 6 .8 0 1-.6 1-1.2v-1c0-.4-.3-.7-.7-.8l-1.6-.4c-.3-.1-.6 0-.8.3l-.3.5c-1.1-.5-2-1.4-2.5-2.5l.5-.3c.3-.2.4-.5.3-.8L10 7.7c-.1-.4-.4-.7-.8-.7h-1C7.6 7 7 7.2 7 8c0 .5.1 1 .3 1.5" />
    </svg>
  );
}

/** Simple monogram — the same fair-use pattern every site's share row
 *  uses, not a recreation of Meta's exact logomark. */
function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 4h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h2.6l.4-4H13V8c0-.6.4-1 1-1h2V4Z" />
    </svg>
  );
}

export function ShareButton({ salon }: { salon: Salon }) {
  // Starts empty, matching what the server renders (window doesn't exist
  // there) — computing this from window.location during the initial
  // render meant the client's first pass, which runs before hydration
  // finishes, disagreed with the server's HTML for every link's href,
  // producing a hydration mismatch on every page render.
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading window.location after mount to avoid an SSR/client hydration mismatch, not a render loop
    setOrigin(window.location.origin);
  }, []);

  const shareUrl = origin ? `${origin}/salon/${salon.slug}` : "";
  const shareText = `Mira ${salon.name}`;

  const targets = [
    {
      icon: WhatsAppGlyph,
      label: "WhatsApp",
      open: () => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, "_blank", "noopener,noreferrer"),
    },
    {
      icon: FacebookGlyph,
      label: "Facebook",
      open: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer"),
    },
    {
      icon: XIcon,
      label: "X",
      open: () =>
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
          "_blank",
          "noopener,noreferrer"
        ),
    },
    {
      icon: Copy,
      label: "Copiar enlace",
      open: async () => {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Enlace copiado");
      },
    },
  ];

  async function handleMainButtonClick() {
    // Native share sheet on mobile/supported browsers skips the hover
    // row entirely — it's the better UX where available, so try it first.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: salon.name, url: shareUrl });
      } catch {
        // User cancelled the share sheet — not an error worth surfacing.
      }
    }
  }

  return (
    <SocialButton
      label="Compartir"
      items={targets}
      onClick={handleMainButtonClick}
      onShare={(index) => targets[index].open()}
      className="h-8 min-w-0 px-3 text-sm"
    />
  );
}
