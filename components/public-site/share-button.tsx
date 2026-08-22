"use client";

import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import type { Salon } from "@/lib/tenant/resolve-salon";
import { cn } from "@/lib/utils";

export function ShareButton({ salon }: { salon: Salon }) {
  const [open, setOpen] = useState(false);
  // window.location.origin is unavailable during SSR. Reading it directly in
  // render made the server output (empty string) diverge from the client's
  // first hydration pass (real origin, since `window` already exists by
  // then) — a hydration mismatch. Deferring to an effect keeps SSR and the
  // initial client render identical; the real links appear a tick later.
  const [origin, setOrigin] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    // Standard menu-button pattern: move focus into the panel on open so
    // keyboard/screen-reader users land somewhere meaningful instead of on
    // a trigger that now says "expanded" with nothing else to Tab to.
    firstItemRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleClick() {
    const url = `${window.location.origin}/salon/${salon.slug}`;
    // Native share sheet on mobile/supported browsers skips the dropdown
    // entirely — it's the better UX where available, so try it first.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: salon.name, url });
      } catch {
        // User cancelled the share sheet — not an error worth surfacing.
      }
      return;
    }
    setOpen((v) => !v);
  }

  const shareUrl = origin ? `${origin}/salon/${salon.slug}` : "";
  const shareText = `Mira ${salon.name}`;

  const links = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
    },
    {
      key: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      key: "x",
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
  ];

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Enlace copiado");
    setOpen(false);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        aria-expanded={open}
        aria-label="Compartir"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <Share2 className="size-4" />
        <span className="hidden sm:inline">Compartir</span>
      </button>
      <div
        inert={!open}
        className={cn(
          "absolute top-full right-0 mt-3 w-48 rounded-md border border-border bg-background p-2 shadow-lg transition-[opacity,transform]",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        )}
      >
        <ul className="flex flex-col">
          {links.map((l, i) => (
            <li key={l.key}>
              <a
                ref={i === 0 ? firstItemRef : undefined}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block rounded-sm px-2 py-1.5 font-sans text-sm text-foreground hover:bg-muted"
              >
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={copyLink}
              className="block w-full rounded-sm px-2 py-1.5 text-left font-sans text-sm text-foreground hover:bg-muted"
            >
              Copiar enlace
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
