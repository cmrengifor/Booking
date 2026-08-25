"use client";

/**
 * @author: @dorianbaffier
 * @description: Switch Button
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SwitchButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "minimal";
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
}

export default function SwitchButton({
  className,
  variant = "minimal",
  size = "default",
  showLabel = true,
  ...props
}: SwitchButtonProps) {
  const { setTheme, theme } = useTheme();
  // next-themes resolves the real theme from localStorage synchronously on
  // the client's first render, which the server (no localStorage) can't
  // know — branching on `theme` before mount produces a hydration mismatch.
  // Rendering the light-mode markup until mounted keeps the first client
  // pass identical to the server, matching next-themes' documented fix.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the standard next-themes hydration-safe mount gate, not a render loop
  useEffect(() => setMounted(true), []);
  const isDark = mounted && theme === "dark";

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const variants = {
    minimal: [
      "rounded-lg",
      "bg-background",
      "hover:bg-muted",
      "border border-border",
      "hover:border-gold/40",
      "shadow-[0_1px_2px_-1px_rgb(0_0_0/0.1),0_1px_3px_-2px_rgb(0_0_0/0.1)]",
      "hover:shadow-[0_2px_4px_-2px_rgb(0_0_0/0.15),0_2px_6px_-3px_rgb(0_0_0/0.15)]",
      "active:shadow-[0_0px_1px_0_rgb(0_0_0/0.1)]",
      "transition-all duration-200 ease-out",
      "backdrop-blur-sm",
      "relative",
      "after:absolute after:inset-0 after:rounded-lg after:bg-gradient-to-t after:from-white/10 after:to-transparent after:opacity-0 hover:after:opacity-100 after:transition-opacity",
      "before:absolute before:inset-[1px] before:rounded-[7px] before:bg-gradient-to-b before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity dark:before:from-white/5",
    ],
  };

  const sizes = {
    sm: "h-8 px-3 text-sm",
    default: "h-10 px-4",
    lg: "h-11 px-5",
  };

  return (
    <Button
      className={cn(
        "group relative",
        "transition-all duration-300 ease-out",
        "text-muted-foreground",
        "hover:text-foreground",
        variants[variant],
        sizes[size],
        className
      )}
      onClick={handleThemeToggle}
      {...props}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          "transition-all duration-300 ease-out"
        )}
      >
        <Sun
          className={cn(
            "transition-all duration-700 ease-in-out",
            size === "sm" && "h-3.5 w-3.5",
            size === "default" && "h-4 w-4",
            size === "lg" && "h-5 w-5",
            "group-hover:rotate-[360deg] group-hover:scale-110",
            isDark ? "rotate-180" : "rotate-0",
            "transform-gpu",
            "drop-shadow-[0_0_12px_rgba(180,144,63,0.35)]",
            isDark
              ? "text-muted-foreground group-hover:text-foreground"
              : "text-gold group-hover:text-gold",
            "group-active:scale-95"
          )}
        />
        {showLabel && (
          <span
            className={cn(
              "relative font-medium capitalize",
              "transition-opacity duration-300 ease-out"
            )}
          >
            <span
              className={cn(
                "absolute inset-0",
                isDark ? "opacity-0" : "opacity-100",
                "transition-opacity duration-300 ease-out"
              )}
            >
              Claro
              <span
                className={cn(
                  "absolute -bottom-px left-0 h-px w-full",
                  "bg-linear-to-r from-foreground/0 via-foreground/40 to-foreground/0",
                  "opacity-0 group-hover:opacity-100",
                  "transition-opacity duration-200"
                )}
              />
            </span>
            <span
              className={cn(
                "absolute inset-0",
                isDark ? "opacity-100" : "opacity-0",
                "transition-opacity duration-300 ease-out"
              )}
            >
              Oscuro
              <span
                className={cn(
                  "absolute -bottom-px left-0 h-px w-full",
                  "bg-linear-to-r from-foreground/0 via-foreground/40 to-foreground/0",
                  "opacity-0 group-hover:opacity-100",
                  "transition-opacity duration-200"
                )}
              />
            </span>
            <span className="opacity-0">Claro</span>
          </span>
        )}
      </div>
      <span
        className={cn(
          "absolute inset-0",
          "bg-gradient-to-r from-foreground/0 via-foreground/[0.08] to-foreground/0",
          "translate-x-[-100%]",
          "group-hover:translate-x-[100%]",
          "transition-transform duration-500",
          "ease-in-out",
          "pointer-events-none",
          "z-[1]"
        )}
      />
      <span
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100",
          "bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.12),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.07),transparent_70%)]",
          "transition-opacity duration-500",
          "pointer-events-none",
          "z-[2]"
        )}
      />
    </Button>
  );
}
