"use client";

/**
 * Adapted from kokonutui's Avatar Picker (kokonutui.com/docs/inputs/avatar-picker)
 * — the original is an onboarding card with a username field and a "Get
 * Started" CTA; here it's just the animated stage + thumbnail strip,
 * controlled from outside (selectedId/onSelect) so the caller owns saving.
 * The four avatars themselves come from lib/avatars.ts, the shared catalog
 * the server also reads to validate a selection and resolve it to a URL.
 *
 * @author: @dorianbaffier
 * @website: https://kokonutui.com
 */

import type { Variants } from "motion/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { PRESET_AVATARS } from "@/lib/avatars";
import { cn } from "@/lib/utils";

const containerVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const thumbnailVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: "easeOut" },
  },
};

export function AvatarPicker({
  selectedId,
  onSelect,
  className,
}: {
  selectedId: number;
  onSelect: (id: number) => void;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const selected = PRESET_AVATARS.find((a) => a.id === selectedId) ?? PRESET_AVATARS[0];

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/*
       * Two-div approach: outer div holds the animated color ring (no
       * overflow-hidden so box-shadow renders cleanly), inner div clips
       * the avatar SVG.
       */}
      <div className="relative h-32 w-32">
        <motion.div
          animate={{
            boxShadow: `0 0 0 2px rgba(${selected.rgb}, 0.55), 0 6px 24px rgba(${selected.rgb}, 0.18)`,
          }}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
        />

        <div className="relative h-full w-full overflow-hidden rounded-full">
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key={selected.id}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
            >
              {/* scale-[3.2]: 40px SVG × 3.2 ≈ fills the 128px circle */}
              <div
                className="scale-[3.2] transform"
                dangerouslySetInnerHTML={{ __html: selected.svg }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <motion.div animate="animate" className="flex gap-3" initial="initial" variants={containerVariants}>
        {PRESET_AVATARS.map((avatar) => {
          const isSelected = selected.id === avatar.id;
          return (
            <motion.button
              aria-label={`Elegir ${avatar.alt}`}
              aria-pressed={isSelected}
              className={cn(
                "relative h-12 w-12 overflow-hidden rounded-xl border bg-muted transition-[opacity,box-shadow] duration-200 ease-out",
                isSelected
                  ? "border-foreground/20 opacity-100 ring-2 ring-foreground/70 ring-offset-2 ring-offset-background"
                  : "border-border opacity-50 hover:opacity-100"
              )}
              key={avatar.id}
              onClick={() => onSelect(avatar.id)}
              type="button"
              variants={thumbnailVariants}
              whileHover={shouldReduceMotion ? {} : { scale: 1.06 }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.94 }}
            >
              <div
                className="absolute inset-0 flex items-center justify-center [&>svg]:scale-[2]"
                dangerouslySetInnerHTML={{ __html: avatar.svg }}
              />
              {isSelected && (
                <div className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                  <Check aria-hidden="true" className="h-3 w-3 text-background" />
                </div>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
