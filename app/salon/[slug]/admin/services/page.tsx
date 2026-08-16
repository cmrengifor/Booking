import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getSalonMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ActiveSwitch } from "./active-switch";
import { DeleteButton } from "./delete-button";
import { SplitInput } from "./split-input";
import { PromotionsSection } from "./promotions-section";
import {
  createCategory,
  createService,
  deleteCategory,
  deleteService,
  toggleCategoryActive,
  toggleServiceActive,
} from "./actions";

export default async function AdminServicesPage({
  params,
}: PageProps<"/salon/[slug]/admin/services">) {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return null;

  const membership = await getSalonMembership(salon.id);
  // Services are owner/manager-editable only at the RLS level — hide the
  // write UI for other roles instead of showing controls that error on
  // submit (found while auditing every role's admin experience).
  const canEdit = membership?.role === "owner" || membership?.role === "manager";

  const supabase = await createClient();
  const [{ data: categories }, { data: services }, { data: variants }, { data: promotions }] =
    await Promise.all([
      supabase
        .from("service_categories")
        .select("*")
        .eq("salon_id", salon.id)
        .order("sort_order"),
      supabase
        .from("services")
        .select("*")
        .eq("salon_id", salon.id)
        .order("sort_order"),
      supabase
        .from("service_variants")
        .select("*")
        .eq("salon_id", salon.id)
        .order("sort_order"),
      supabase
        .from("service_promotions")
        .select("*")
        .eq("salon_id", salon.id)
        .order("starts_at", { ascending: false }),
    ]);

  const createCategoryAction = createCategory.bind(null, salon.id, slug);
  const createServiceAction = createService.bind(null, salon.id, slug);

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <p className="font-sans text-xs tracking-[0.3em] text-gold uppercase">
          Panel del salón
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground">
          Servicios
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        {categories?.map((category) => (
          <div
            key={category.id}
            className="rounded-md border border-border p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg text-foreground">
                {category.name}
              </h2>
              {canEdit ? (
                <div className="flex items-center gap-3">
                  <ActiveSwitch
                    action={toggleCategoryActive}
                    id={category.id}
                    slug={slug}
                    active={category.active}
                  />
                  <DeleteButton
                    action={deleteCategory}
                    id={category.id}
                    slug={slug}
                    confirmMessage={`¿Eliminar la categoría "${category.name}"? Si tiene servicios asociados, se archivará en su lugar.`}
                  />
                </div>
              ) : (
                <span className="font-sans text-xs text-muted-foreground">
                  {category.active ? "Activa" : "Inactiva"}
                </span>
              )}
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {services
                ?.filter((s) => s.category_id === category.id)
                .map((service) => {
                  const serviceVariants = variants?.filter(
                    (v) => v.service_id === service.id
                  );
                  return (
                    <li
                      key={service.id}
                      className="flex flex-col gap-2 rounded-md bg-muted/40 px-3 py-2 font-sans text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-foreground">
                            {service.name}
                          </span>{" "}
                          {service.has_variants ? (
                            <span className="text-muted-foreground">
                              {serviceVariants
                                ?.map((v) => `${v.name} $${v.price}`)
                                .join(" · ")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              ${service.base_price} ·{" "}
                              {service.base_duration_minutes} min
                            </span>
                          )}
                        </div>
                        {canEdit ? (
                          <div className="flex items-center gap-3">
                            <ActiveSwitch
                              action={toggleServiceActive}
                              id={service.id}
                              slug={slug}
                              active={service.active}
                            />
                            <DeleteButton
                              action={deleteService}
                              id={service.id}
                              slug={slug}
                              confirmMessage={`¿Eliminar "${service.name}"? Si tiene citas asociadas, se archivará en su lugar.`}
                            />
                          </div>
                        ) : (
                          <span className="font-sans text-xs text-muted-foreground">
                            {service.active ? "Activo" : "Inactivo"}
                          </span>
                        )}
                      </div>
                      {canEdit && (
                        <>
                          <SplitInput
                            serviceId={service.id}
                            slug={slug}
                            initialSplit={service.artist_split_percent}
                          />
                          <PromotionsSection
                            serviceId={service.id}
                            salonId={salon.id}
                            slug={slug}
                            timezone={salon.timezone}
                            promotions={
                              promotions?.filter((p) => p.service_id === service.id) ?? []
                            }
                          />
                        </>
                      )}
                    </li>
                  );
                })}
              {!services?.some((s) => s.category_id === category.id) && (
                <p className="font-sans text-xs text-muted-foreground">
                  Sin servicios todavía.
                </p>
              )}
            </ul>
          </div>
        ))}
      </div>

      {!canEdit && (
        <p className="font-sans text-xs text-muted-foreground">
          Solo el owner o manager pueden crear o editar servicios.
        </p>
      )}

      {canEdit && (
      <div className="grid gap-6 sm:grid-cols-2">
        <form
          action={createCategoryAction}
          className="flex flex-col gap-3 rounded-md border border-border p-4"
        >
          <h3 className="font-sans text-sm font-medium text-foreground">
            Nueva categoría
          </h3>
          <input
            name="name"
            required
            placeholder="Nombre"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" size="sm">
            Crear categoría
          </Button>
        </form>

        <form
          action={createServiceAction}
          className="flex flex-col gap-3 rounded-md border border-border p-4"
        >
          <h3 className="font-sans text-sm font-medium text-foreground">
            Nuevo servicio (sin variantes)
          </h3>
          <select
            name="category_id"
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Categoría…</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            name="name"
            required
            placeholder="Nombre"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            name="description"
            placeholder="Descripción (opcional)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <input
              name="base_price"
              type="number"
              step="0.01"
              required
              placeholder="Precio"
              className="w-1/2 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              name="base_duration_minutes"
              type="number"
              required
              placeholder="Duración (min)"
              className="w-1/2 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <input
            name="buffer_minutes"
            type="number"
            placeholder="Buffer (min, opcional)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" size="sm">
            Crear servicio
          </Button>
        </form>
      </div>
      )}
    </div>
  );
}
