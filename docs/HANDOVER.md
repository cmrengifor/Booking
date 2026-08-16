# Handover — Nail Salon Booking (Atelier Noir demo)

Última actualización: 2026-08-17 (sesión que terminó con el fix del reloj analógico).

## 1. Qué es esto

SaaS multi-tenant de reservas para salones de belleza premium. Next.js/Supabase/Vercel.
Repo: `github.com/cmrengifor/Booking` (público, rama `main`).
Producción: `https://nail-salon-booking-silk.vercel.app`
Salón demo (100% ficticio, per `PRODUCT.md`): **Atelier Noir**, slug `atelier-noir`.

Stack: Next.js 16.3.1 (App Router, Turbopack), React 19.2.8, TypeScript, Tailwind v4
(tokens vía `@theme` en `app/globals.css`, sin `tailwind.config.js`), shadcn/ui estilo
`base-nova` (Base UI primitives, no Radix — usa prop `render`, no `asChild`).
Supabase: Postgres, Auth (Google OAuth + email/password), Storage, RLS, funciones
`SECURITY DEFINER` para toda escritura sensible. Vercel: equipo `bearbecue`, plan Hobby.

Docs de referencia en el repo: `docs/ARCHITECTURE.md` (arquitectura aprobada + estado),
`PRODUCT.md`, `DESIGN.md` (escritos con la skill `impeccable`).

## 2. Cómo se trabaja en este proyecto (patrón establecido)

Cada tanda de correcciones sigue el mismo ciclo:
1. Usuario da una lista de correcciones/ideas, a veces dice explícitamente "no implementes nada hasta que te dé la orden".
2. Yo investigo el código real (sin editar), señalo ambigüedades, hago preguntas concretas
   vía `AskUserQuestion` cuando el alcance cambia sustancialmente (ej. sucursales físicas
   vs. modalidad de servicio), y propongo un orden de fases.
3. Usuario confirma respuestas y dice "corre/implementa las fases".
4. Implemento fase por fase: `TaskCreate`/`TaskUpdate` para trackear, `npx tsc --noEmit` +
   `npx eslint .` + `npm test` + `npm run build` después de cambios grandes, y verificación
   real en navegador (Browser pane, dev server vía `preview_start`) — nunca doy por
   verificado algo sin haberlo visto correr.
5. Usuario dice "Run commit, push and deploy" — **nunca antes**. Entonces: `git add` selectivo
   (nunca `-A` sin revisar `git status` primero), commit con mensaje descriptivo, push,
   luego `npx vercel ls` + poll con `vercel inspect` hasta `● Ready`, y verificación final
   en la URL de producción (texto de página + a veces `getComputedStyle` vía JS para bugs
   visuales).

**No hacer commit/push/deploy sin que el usuario lo pida explícitamente en ese turno.**

## 3. Estado actual (todo en producción, verificado)

### Datos del salón demo
- Salón: Atelier Noir, `America/Bogota`.
- **2 sedes** (`salon_locations`): **Chapinero** (staff: Sofia, horario Tue–Sat 09:00–18:00)
  y **Zona Rosa** (staff: Valentina, horario Tue–Sat 10:00–19:00) — deliberadamente
  distintas para poder verificar el filtro por sede.
- Servicios: categoría única "Manicure y Uñas" (Manicure con variantes Clásica/Gel/French
  Gel, Acrílicas) + categoría "Pedicure" (Pedicure Spa). En el wizard de reserva ya no se
  agrupan por categoría (ver más abajo).
- 1 cliente ficticio ("Camila Rojas") con 2 citas completadas + reseñas publicadas (una
  por artista) para que la landing no se vea vacía.
- `social_links` de Atelier Noir está **vacío a propósito** — no se inventaron URLs falsas
  de Instagram/Facebook para no enlazar por accidente a cuentas reales. El botón
  "Contáctanos" cae de vuelta a mostrar teléfono/correo mientras tanto.

### Flujo de reserva (`app/salon/[slug]/book/`)
Wizard de 6 pasos dirigido por `searchParams` (no por estado de componente aislado):
**Ubicación → Servicio → Artista → Fecha → Hora → Confirmar**.

- `booking-wizard.tsx` — orquestador. Reglas clave:
  - La cascada dentro de un paso (expandir categoría/servicio) es **estado local puro**
    (`useState`), nunca toca la URL — solo la elección final (variante o servicio sin
    variantes) hace `setParams()` y avanza de paso. Esto se corrigió explícitamente porque
    antes cada clic intermedio cambiaba la URL y se sentía como "me sacó de la sección".
  - Un salón con **una sola sede** salta automáticamente el paso 1 (`useEffect` que
    autoselecciona si `locations.length === 1`).
  - El botón "Reservar" en la ficha de un artista (`artists-section.tsx`) precarga
    `artistId` **y** `locationId` (la sede de ese artista) para saltarse pasos.
  - El botón "Reservar" en la sección de Servicios (`services-section.tsx`) precarga solo
    `serviceId` — si el servicio tiene variantes, el wizard muestra directamente el
    selector de variantes de ESE servicio (no el acordeón completo).
- `stepper.tsx` — pasos: `["Ubicación", "Servicio", "Artista", "Fecha", "Hora", "Confirmar"]`.
- `time-picker.tsx` — carrusel **vertical** (antes horizontal) de bloques 15-min de 8am a
  8pm, rellenos sólidos verde (disponible) / rojo (no disponible), texto blanco.
- `analog-clock.tsx` — reloj visual "plus" junto al carrusel (no es el input principal).
  **Corregido en la última sesión**: las horas ahora están en su posición REAL de reloj
  (12 arriba, 3 a la derecha, etc., calculado con `hour % 12`, no por índice de arreglo) y
  muestran formato 24h/militar (`08`...`19`) en vez de convertir a 12h. Cada hora está
  dentro de un círculo relleno verde/rojo. La aguja sigue el hover, no solo la selección.
- Paso "Confirmar" muestra: Sede, Servicio, Con (artista), y
  `Martes 18 Agosto, 09:00 — COT (UTC-5)` — día/mes capitalizados manualmente (Luxon
  locale `es` los da en minúsculas), sin paréntesis alrededor del huso horario.
  Correo de confirmación = correo de la sesión (requiere login; no hay reserva de invitado
  todavía — ver sección 5).

### Multi-sede (cambio de arquitectura grande de esta sesión)
- Tabla nueva `salon_locations` (id, salon_id, name, address, contact_phone, sort_order,
  active). RLS: público lee activas, owner/manager escribe.
- `salon_memberships.location_id` y `artist_profiles.location_id` (nullable) — cada
  stylist pertenece a una sede.
- `salon_weekly_hours` ahora depende de `location_id` (antes de `salon_id` directo);
  constraint única cambió de `(salon_id, day_of_week)` a `(location_id, day_of_week)`.
- `appointments.location_id` (**NOT NULL**) — no siempre derivable de
  `salon_membership_id` (una cita "cualquier artista" abierta no tiene membership), así
  que se captura explícito en el momento de reservar.
- RPC `book_appointment` cambió de firma (ganó `p_location_id`) — se hizo `DROP FUNCTION`
  + `CREATE` porque `CREATE OR REPLACE` con firma distinta crea un overload en vez de
  reemplazar.
- `getAvailableSlots`/`confirmBooking` (en `book/actions.ts`) ahora requieren `locationId`
  y filtran `salon_weekly_hours`/`artist_profiles` por esa sede.
- **No se construyó** una UI de admin para gestionar sedes (crear/editar) — fuera de
  alcance de lo pedido, se hizo solo lo necesario para que el wizard funcione. Si se
  necesita administrar sedes desde el panel, es trabajo pendiente.

### Landing page (`app/salon/[slug]/page.tsx` + `components/public-site/`)
- Header: `Atelier Noir` (logo, hace scroll-to-top si ya estás en la página), `Servicios`
  (ancla `/salon/[slug]#servicios`, con ruta explícita para que funcione desde cualquier
  página), `Obras de Arte` (antes dos links separados "Portfolio" + "Nuestros Artistas",
  fusionados en uno solo que lleva a `/salon/[slug]/portfolio`), `Mi cuenta`, y
  `Contáctanos` (dropdown con redes sociales + teléfono/correo).
- Secciones landing (sin cambios en su estructura interna desde antes): Hero, Servicios
  (ordenados de mayor a menor precio, con carrusel de fotos por servicio, botón Reservar
  por servicio), Nuestros Artistas (bio, about me, tags de intereses), Portfolio (agrupado
  por artista: obra en carrusel + reseña de servicio), Brands, Reseñas (estrellas
  doradas), FAQ.
- Footer (`site-footer.tsx`): una sola fila con Atelier Noir / Novedades (newsletter,
  antes era su propia sección grande, ahora columna del footer) / Trabaja con nosotros /
  copyright, alineados por abajo (`items-end`). Debajo, fila centrada de redes sociales
  (solo aparece si `social_links` tiene datos).
- `/salon/[slug]/portfolio` — página de "Obras de Arte": filtro por artista (Todos = 6
  fotos random, artista específico = hasta 10, curables por `sort_order`).
- `/salon/[slug]/privacidad` — aviso de manejo de datos (Ley 1581 de 2012 Colombia),
  enlazado desde el formulario de newsletter y el de Trabaja con nosotros.
- "Trabaja con nosotros" (`careers-section.tsx` + `careers-actions.ts`): sube CV a bucket
  privado de Storage (`job-applications`, sin políticas públicas) + guarda en tabla
  `job_applications`, todo vía `lib/supabase/admin.ts` (service-role, sin grant público de
  insert). **No hay envío de correo real todavía** — pendiente de Resend.

### Bugs reales corregidos esta sesión (no solo pedidos de producto)
- **Contraste del botón hero "Reservar una cita"**: `tailwind-merge` no deduplicaba
  `text-black` contra el `text-primary-foreground` que trae `buttonVariants()` por
  defecto — quedaban ambas clases y ganaba la casi-blanca (texto invisible sobre blanco).
  Fix: usar el modificador `!` de Tailwind v4 (`bg-white!`, `text-black!`) en vez de
  confiar en el orden de merge. **Ojo con este patrón en cualquier botón futuro que
  combine `buttonVariants()` con colores custom.**
- **Lentitud "Mi cuenta" ↔ volver**: `auth.getUser()` se llamaba dos veces por request
  (una en el layout, otra en la page) porque es un round-trip real al servidor de auth de
  Supabase, no una decodificación local. Fix: envolver los helpers de
  `lib/auth/session.ts` en `cache()` de React para deduplicar por request. Se agregó
  también `loading.tsx` para feedback inmediato.
- **"Servicios" no navegaba desde otras páginas**: el link era un `<a href="#servicios">`
  sin prefijo de ruta — desde `/portfolio` eso reescribía el hash de esa misma página en
  vez de navegar. Fix: `Link href="/salon/[slug]#servicios"`.

## 4. Peculiaridades técnicas a tener en cuenta

- **Migraciones**: se aplican con `npx supabase db push --linked` (sin Docker — usa la API
  de gestión remota). El seed se corre aparte con
  `npx supabase db query --linked -f supabase/seed.sql`. Después de CUALQUIER cambio de
  esquema: `npx supabase gen types typescript --linked > types/database.ts`.
- **`supabase/seed.sql` es idempotente y solo tiene datos ficticios** (marcado así en el
  propio archivo). Nunca poner contraseñas fijas ahí — usa `crypt(gen_random_uuid()::text, ...)`
  porque el repo es público.
- **Cambiar la firma de una función RPC** (agregar/quitar parámetros) requiere
  `DROP FUNCTION IF EXISTS` explícito antes de `CREATE FUNCTION` — `CREATE OR REPLACE`
  con una firma distinta deja las dos versiones (overload), no reemplaza.
- **Locale de fechas**: Luxon no toma español automáticamente — hay que encadenar
  `.setLocale("es")`, y el resultado viene en minúsculas (hay que capitalizar a mano si
  se necesita, ver `capitalize()` en `booking-wizard.tsx`).
- **Testing del navegador — trampa real encontrada esta sesión**: navegar con `navigate()`
  directo a una URL que YA trae `searchParams` con los que dependen `useEffect` (ej.
  `?date=2026-08-18` para disparar `getAvailableSlots`) a veces **no dispara el effect**
  de forma confiable en el harness de pruebas (parece timing/HMR, no pasa con usuarios
  reales). **Siempre verificar flujos con clics reales o `form_input` sobre el DOM ya
  montado**, no con hard-navigation a una URL con estado pre-cargado. Si algo muestra "0
  disponible" de la nada, sospechar de esto antes de asumir que el código está roto.
- **Patrón de RLS**: cada tabla de tenant tiene su propio `salon_id` denormalizado (no
  solo derivable por join) para que las políticas RLS sean planas. Se extendió el mismo
  patrón a `location_id` en esta sesión.
- **Toda escritura sensible pasa por una función `SECURITY DEFINER`** (appointments,
  reviews, job_applications) — nunca hay `INSERT`/`UPDATE` directo con grant a
  `authenticated` en esas tablas.

## 5. Pendiente / diferido (mencionado explícitamente en algún momento, no resuelto)

- **Auditoría de responsividad móvil** — pospuesta explícitamente por el usuario. Las
  clases responsive (`sm:`, `lg:`) están puestas en todo lo construido, pero nunca se
  verificó en viewport móvil real dentro de este proyecto.
- **Mejoras al dashboard de admin/analytics** — existe (`/admin/analytics`: ingresos,
  citas completadas, clientes, ticket promedio, cancelación, no-show, calificación,
  ingresos por servicio, por artista, horas pico) pero el usuario no dio dirección sobre
  qué mejorar (rango de fechas, gráficos más ricos, exportar).
- **Reserva sin login (solo correo)** — el usuario preguntó viabilidad; recomendé el
  patrón de "cuenta invisible" (crear un `auth.users` sin contraseña vía admin client,
  nunca mostrar formulario de registro) para no tocar el modelo de identidad existente.
  **Bloqueado por**: no hay proveedor de email real conectado todavía.
- **Resend (u otro proveedor de email)** — pendiente desde hace varias rondas. Bloquea:
  email real de "Trabaja con nosotros", cualquier futura reserva sin login, y en general
  cualquier notificación transaccional real (el sistema de notificaciones in-app ya
  funciona, el envío de email está "stubbed").
- **Datos reales del salón piloto** — todo sigue siendo Atelier Noir ficticio. Falta
  reemplazar con la info real del cliente de Carlos cuando la tenga.
- **`social_links` vacío** — falta que Carlos entregue los handles reales de redes
  sociales para poblarlo (la UI ya está lista, solo falta el dato).
- **Admin UI para gestionar sedes** — no se construyó (crear/editar/desactivar sedes,
  reasignar staff). Si se necesita, es una fase nueva.

## 6. Mapa de archivos clave

```
app/salon/[slug]/
  page.tsx                       landing page (composición de secciones)
  book/
    page.tsx                     fetch de datos (sedes, servicios, artistas) + wraps wizard
    booking-wizard.tsx            orquestador del wizard, 6 pasos, estado en URL
    actions.ts                    getAvailableSlots / confirmBooking (server actions)
    stepper.tsx                   indicador de progreso
    time-picker.tsx               carrusel vertical de horarios
    analog-clock.tsx              reloj visual "plus"
  portfolio/page.tsx              "Obras de Arte", filtro por artista
  privacidad/page.tsx             aviso de manejo de datos
  careers-actions.ts              aplicar a vacante (Storage + tabla, sin email real)
  account/, admin/, notifications/  sin cambios grandes esta sesión

components/public-site/
  site-header.tsx                 nav + dropdown Contáctanos
  site-footer.tsx                 fila unificada + redes sociales
  hero.tsx, services-section.tsx, artists-section.tsx, portfolio-section.tsx,
  reviews-section.tsx, newsletter-section.tsx, careers-section.tsx, image-carousel.tsx

lib/
  domain/availability.ts          motor de disponibilidad puro (testeado, sin cambios de lógica)
  social-links.ts                 helper compartido header/footer para social_links
  auth/session.ts                 helpers de sesión, envueltos en cache()
  supabase/{client,server,admin}.ts

supabase/
  migrations/*.sql                 último: 20260817000000_salon_locations.sql
  seed.sql                         datos ficticios de Atelier Noir (2 sedes)

docs/ARCHITECTURE.md               arquitectura aprobada + sección de estado
docs/HANDOVER.md                   este archivo
```

## 7. Cómo retomar

1. Leer este archivo + `docs/ARCHITECTURE.md` (sección de estado al final).
2. `git log --oneline -20` para ver el historial reciente (cada commit de "ronda" trae
   una descripción larga de qué se hizo y por qué).
3. Si vas a tocar el wizard de reserva, entender primero el patrón de "estado local vs.
   URL" descrito en la sección 3 — es fácil reintroducir el bug de "cada clic cambia de
   sección" si no se respeta.
4. Antes de cualquier cambio de esquema, recordar el flujo: migración → `db push` →
   `seed.sql` si aplica → regenerar `types/database.ts`.
5. Nunca hacer `git push` / deploy sin que el usuario lo pida explícitamente en el turno
   actual — es el patrón que se ha seguido sin excepción en todas las rondas.
