"use client";

import { useRouter } from "next/navigation";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { type CalendarMode, type Stylist, appointmentsHref } from "./calendar-shared";

type StylistOption = { id: string | null; label: string };

export function StylistFilterCombobox({
  base,
  view,
  mode,
  dateISO,
  stylists,
  stylistFilter,
}: {
  base: string;
  view: "list" | "calendar";
  mode: CalendarMode;
  dateISO: string;
  stylists: Stylist[];
  stylistFilter: string | null;
}) {
  const router = useRouter();

  const options: StylistOption[] = [
    { id: null, label: "Todos" },
    ...stylists.map((s) => ({ id: s.id, label: s.artist_profiles?.display_name ?? "Sin nombre" })),
  ];
  const selected = options.find((o) => o.id === stylistFilter) ?? options[0];

  // Always-visible input, not a button-style ComboboxTrigger — verified live
  // (with and without a Button `render` wrapper) that a real click never
  // opens a ComboboxTrigger in this stack (React 19.2.8 / Next 16 Turbopack
  // / @base-ui/react 1.7.0): aria-expanded never flips on pointerdown/click,
  // only on a JS-synthesized `.click()`. Same failure class documented for
  // @base-ui/react's Menu family in admin-nav.tsx. Focus-driven opening (this
  // input, or the small in-input chevron with showTrigger left on) doesn't
  // hit that path and works correctly.
  return (
    <Combobox
      items={options}
      value={selected}
      itemToStringLabel={(o) => o.label}
      isItemEqualToValue={(item, value) => item.id === value.id}
      onValueChange={(option) => {
        if (!option) return;
        router.push(appointmentsHref(base, { view, mode, dateISO, stylist: option.id }));
      }}
    >
      <ComboboxInput showTrigger={false} placeholder="Filtrar por stylist…" className="w-44" />
      <ComboboxContent>
        <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
        <ComboboxList>
          {(option: StylistOption) => (
            <ComboboxItem key={option.id ?? "all"} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
