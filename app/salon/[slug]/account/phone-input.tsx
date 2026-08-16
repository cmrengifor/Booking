"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  { code: "+57", iso: "CO", flag: "🇨🇴", name: "Colombia" },
  { code: "+52", iso: "MX", flag: "🇲🇽", name: "México" },
  { code: "+1", iso: "US", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "+34", iso: "ES", flag: "🇪🇸", name: "España" },
  { code: "+54", iso: "AR", flag: "🇦🇷", name: "Argentina" },
  { code: "+51", iso: "PE", flag: "🇵🇪", name: "Perú" },
  { code: "+56", iso: "CL", flag: "🇨🇱", name: "Chile" },
  { code: "+58", iso: "VE", flag: "🇻🇪", name: "Venezuela" },
  { code: "+593", iso: "EC", flag: "🇪🇨", name: "Ecuador" },
  { code: "+507", iso: "PA", flag: "🇵🇦", name: "Panamá" },
];

/** Splits a stored "+57 3001234567"-style value into country code + rest. */
function parseValue(value: string) {
  const match = COUNTRIES.find((c) => value.startsWith(c.code));
  if (match) {
    return { country: match, number: value.slice(match.code.length).trim() };
  }
  return { country: COUNTRIES[0], number: value };
}

export function PhoneInput({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: string;
}) {
  const initial = parseValue(defaultValue ?? "");
  const [country, setCountry] = useState(initial.country);
  const [number, setNumber] = useState(initial.number);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const combined = number ? `${country.code} ${number}` : "";

  return (
    <div ref={wrapperRef} className="relative flex">
      <input type="hidden" name={name} value={combined} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex shrink-0 items-center gap-1 rounded-l-md border border-r-0 border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        <span>{country.flag}</span>
        <span className="text-muted-foreground">{country.code}</span>
      </button>
      <input
        type="tel"
        value={number}
        onChange={(e) => setNumber(e.target.value.replace(/[^\d\s-]/g, ""))}
        placeholder="Teléfono"
        className="w-full rounded-r-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {open && (
        <ul className="absolute top-full left-0 z-10 mt-1 max-h-56 w-56 overflow-y-auto rounded-md border border-border bg-background p-1 shadow-lg">
          {COUNTRIES.map((c) => (
            <li key={c.iso}>
              <button
                type="button"
                onClick={() => {
                  setCountry(c);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-sans text-sm hover:bg-muted",
                  c.iso === country.iso && "bg-muted"
                )}
              >
                <span>{c.flag}</span>
                <span className="flex-1 text-foreground">{c.name}</span>
                <span className="text-muted-foreground">{c.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
