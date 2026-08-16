import { cn } from "@/lib/utils";

const STEPS = ["Servicio", "Artista", "Fecha", "Hora", "Confirmar"];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const state =
          stepNum < current ? "done" : stepNum === current ? "current" : "upcoming";
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[0.7rem]",
                  state === "done" && "bg-gold text-background",
                  state === "current" && "border border-gold text-gold",
                  state === "upcoming" && "border border-border text-muted-foreground"
                )}
              >
                {stepNum}
              </span>
              <span
                className={cn(
                  "hidden font-sans text-xs sm:inline",
                  state === "upcoming" ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {stepNum < STEPS.length && (
              <div
                className={cn(
                  "h-px w-4 sm:w-8",
                  state === "done" ? "bg-gold" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
