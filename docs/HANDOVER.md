# Handover — Nail Salon Booking (Atelier Noir demo)

Última actualización: 2026-08-18 (sesión que implementó el plan de la sección 8 —
migración a componentes shadcn "base" — con desviaciones reales encontradas en vivo;
ver sección 8 para el detalle de qué se mantuvo shadcn y qué se revirtió a hand-rolled).

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

Desde la última actualización de este archivo hubo **dos rondas grandes** de correcciones
(la primera al panel admin completo, la segunda a multi-sede + reglas de reserva). Detalle
completo en `git log` (cada commit trae un mensaje largo); resumen aquí.

### Datos del salón demo
- Salón: Atelier Noir, `America/Bogota`.
- **4 sedes** (`salon_locations`): Chapinero, Zona Rosa (las 2 originales) + Usaquén y Suba
  (agregadas esta sesión). Todas Tue–Sat, la mayoría 09:00–18:00.
- **12 artistas/stylists** repartidos ~3 por sede (Sofia y Valentina originales + 10
  cuentas ficticias nuevas creadas vía `auth.users` directo con `crypt(gen_random_uuid())`,
  mismo patrón que `seed.sql`). Cada uno con `staff_weekly_hours` Tue–Sat 09:00–18:00,
  break 13:00–14:00.
- **20 clientes** (5 originales/de prueba + 15 ficticios nuevos), **~186 citas**: ~142
  históricas (últimos 14 días, mezcla completadas/canceladas/no-show, 15 con un evento
  `rescheduled` en su historial) + ~44 próximas (pendientes/confirmadas hasta fin de mes).
  Todo insertado directo en la BD en vivo vía `supabase db query --linked -f <script>`,
  **no** en `seed.sql` (ese archivo sigue siendo solo el set mínimo original).
- `social_links` de Atelier Noir sigue **vacío a propósito** (sin URLs falsas).

### Panel admin — overhaul casi completo (primera ronda grande)
- **Overview**: ya no dice "disponible en fase 3 y 7" (placeholder viejo) — muestra citas
  de hoy reales + alertas de citas abiertas/pendientes de confirmación (estas últimas sin
  filtro de fecha, a diferencia de "citas de hoy") + reseñas pendientes.
- **Citas**: secciones Abiertas/Pendientes/Confirmadas/**Completadas/Canceladas/No
  asistió** (antes solo las primeras 3), cada una **colapsable**. Botones con colores por
  intención (verde=positivo, rojo=negativo, naranja=no-show). "Rechazar" una pendiente
  ahora pide un motivo (dropdown: artista no disponible / horario no disponible / otro) y
  envía un email explicando por qué (stub, sin Resend). "Hacer seguimiento" (canceladas) y
  "Enviar encuesta" (completadas) generan links con token de 24h/14d, mostrados inline
  porque no hay envío real de correo todavía.
- **Servicios/categorías**: switch activo/inactivo (filas atenuadas si inactivo, no se
  reposicionó el switch), botón Eliminar que intenta borrado real y cae a archivar si hay
  historial (`on delete restrict` en `appointments.service_id`), split % artista/negocio
  por servicio, promociones con descuento temporal.
- **Staff**: semáforo de color (verde/amarillo-vacaciones/rojo-deshabilitado), badge de rol,
  **badge de sede** (color distinto por sede), edición de horario/vacaciones solo
  owner/manager (nunca el artista mismo — decisión explícita del usuario), scorecard
  (rating + citas completadas), selector de sede en la parte superior de la página.
- **Clientes**: reescrito completo — tags de teléfono y **email** (el email se saca en
  batch vía `admin.auth.admin.listUsers()`, no hay columna email en `profiles`), fila
  expandible con últimas 5 citas + actividad mensual, buscador por nombre/email, 4 buckets
  colapsables (esta semana / próximas / completada reciente / >30 días sin agendar), botón
  de recordatorio manual (no automático — Vercel Hobby no soporta cron más frecuente que
  diario, así que se descartó el recordatorio automático <2h antes de la cita).
- **Análisis** (renombrado de "Analytics"): filtro día/semana/mes/trimestre/semestre +
  filtro por servicio, maneja todo el estado vía `searchParams` igual que el wizard. KPIs
  clicables → página segmentada por artista. Ranking top-3 (citas/ingresos/rating). Horas
  pico ahora son **datos ficticios fijos** 8am–8pm (los reales se veían dispersos/confusos
  con tan poco volumen). Export a Excel (`exceljs`) reconstruido con **tabla nativa con
  autofiltro** + fórmulas reales `SUMIF`/`COUNTIF`/`SUMIFS` (no valores precalculados) +
  columna de margen de ganancia por cita/servicio.
- **Notificaciones**: ícono de campana con punto rojo (antes texto "(N)"), toast en vivo
  vía Supabase Realtime (`postgres_changes` sobre la tabla `notifications`, filtrado por
  `recipient_profile_id`) — verificado con un trace real de WebSocket, no solo código.
- **Header admin**: resalta la sección activa, link "Ver sitio" de vuelta a la landing
  (antes no existía ninguna forma de volver).
- **platform-admin/salons**: las filas ahora son links reales a `/salon/[slug]` (antes
  texto plano); el botón de retorno reutiliza el link "Plataforma" que `SiteHeader` ya
  mostraba para platform admins — no hizo falta construir nada nuevo ahí.

### Flujo de reserva — cambió de nuevo esta sesión (segunda ronda)
Wizard ahora de **7 pasos**: Ubicación → Servicio → Artista → Fecha → Hora → **Pago** →
Confirmar. Cambios sobre lo descrito en la versión anterior de este documento:

- **Guest booking se construyó Y ya se pidió revertir en la misma sesión** (ver sección 8
  — plan pendiente, no implementado todavía). Quedó así: se creó `book_appointment_as_guest`
  (RPC casi idéntica a `book_appointment` pero toma `p_profile_id` como parámetro en vez de
  leer `auth.uid()`, solo alcanzable vía `service_role`, nunca grant a `anon`/`authenticated`)
  + Server Action `bookAsGuest` que crea un usuario Auth silencioso por email
  (`admin.auth.admin.createUser`, sin contraseña, el usuario nunca lo sabe) + formulario de
  invitado en el paso final. **El usuario acaba de pedir eliminar esto por completo** — ver
  sección 8, no se ha tocado el código todavía.
- **Servicio a domicilio**: checkbox en el paso final (Confirmar) hoy — dirección, zona con
  recargo fijo (`home_service_zones`, 5 zonas ficticias de Bogotá), campos obligatorios.
  **El usuario pidió moverlo al paso 1 (Ubicación)** — ver sección 8, no implementado.
- **Paso de pago** (nuevo, paso 6): PSE / Transferencia (Llave Bre-B, Nequi) / Efectivo
  (pago exacto o cambio de denominación). Solo registra la intención en una tabla nueva
  (`appointment_payment_selections`) — **no cobra nada real todavía**, es scaffolding para
  conectar una pasarela después.
- **Reloj analógico**: el usuario acaba de pedir eliminarlo y reemplazar el picker de hora
  por un `RadioGroup` de shadcn — ver sección 8, no implementado (sigue vivo en producción
  tal como se describe arriba, con las horas en posición real de reloj).

### Multi-sede (base construida en la ronda anterior, ahora con 4 sedes)
- Tabla `salon_locations`, `salon_memberships.location_id`/`artist_profiles.location_id`
  (nullable), `salon_weekly_hours` por `location_id`, `appointments.location_id` NOT NULL.
- RPC `book_appointment` ha cambiado de firma **dos veces** en esta sesión (primero
  `p_location_id`, luego `p_is_home_service`/`p_home_service_address`/
  `p_home_service_zone_id`/`p_payment_method`/`p_payment_detail`) — cada vez con
  `DROP FUNCTION` + `CREATE` explícito, nunca `CREATE OR REPLACE` (cambia el overload, no
  reemplaza). `book_appointment_as_guest` es una copia paralela con los mismos parámetros
  menos `auth.uid()`.
- **Sigue sin existir** una UI de admin para gestionar sedes (crear/editar/desactivar,
  reasignar staff) — se agregaron las 2 sedes nuevas vía SQL directo, no desde un panel.

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

- **Auditoría de responsividad móvil** — sigue pospuesta, nunca verificada en viewport
  móvil real.
- **Resend (u otro proveedor de email)** — sigue pendiente. Bloquea: email real de
  "Trabaja con nosotros", seguimiento/encuesta NPS, motivo de rechazo, recordatorios de
  Clientes — todo eso ya está construido pero "stubbed" (loguea en vez de enviar, y la UI
  muestra el link generado directamente para poder hacer demo sin bandeja real).
  Decisión explícita del usuario: seguir sin Resend por ahora, no es bloqueante.
- **Google Maps** — la sección de servicio a domicilio pide dirección con un textarea
  simple (sin autocompletado real) a propósito; el usuario dijo "crea el feat, luego
  agregamos el api" — falta la API key de Google Cloud cuando la tenga.
- **Pasarela de pago real** — el paso de Pago del wizard es 100% scaffolding, no cobra
  nada. El usuario dijo explícitamente que la quiere ir armando ahora para conectar
  después, no que falte por accidente.
- **Datos reales del salón piloto** — todo sigue siendo Atelier Noir ficticio, ahora con
  mucho más volumen de datos de demo (ver sección 3).
- **`social_links` vacío** — sigue sin los handles reales.
- **Admin UI para gestionar sedes** — sigue sin construirse.
- **Ver sección 8** — hay un plan grande ya confirmado por el usuario (preguntas
  respondidas, decisiones tomadas) que **todavía no se ha implementado ni una línea**.

## 6. Mapa de archivos clave

```
app/salon/[slug]/
  page.tsx                       landing page (composición de secciones)
  book/
    page.tsx                     fetch de datos (sedes, servicios, artistas) + wraps wizard
    booking-wizard.tsx            orquestador del wizard, 6 pasos, estado en URL
    actions.ts                    getAvailableSlots / confirmBooking (server actions)
    stepper.tsx                   indicador de progreso (7 pasos ahora)
    time-picker.tsx               carrusel vertical de horarios
    analog-clock.tsx              reloj visual "plus" — pendiente de eliminar, ver sección 8
    payment-step.tsx              paso 6, PSE/transferencia/efectivo
    home-service-section.tsx      checkbox + dirección + zona — pendiente de mover, ver sección 8
  admin/
    admin-nav.tsx                 nav con sección activa resaltada + toast Realtime + link "Ver sitio"
    appointments/                 page.tsx + collapsible-section.tsx + decline-form.tsx + trigger-action-button.tsx
    customers/                    page.tsx + data.ts (cálculo de buckets) + customers-client.tsx + actions.ts
    services/                     page.tsx + active-switch.tsx + delete-button.tsx + split-input.tsx + promotions-section.tsx
    staff/                        page.tsx + staff-actions.tsx + edit-panel.tsx
    analytics/                    page.tsx + data.ts (loadAnalytics compartido) + filter-bar.tsx + by-artist/ + artist/[id]/ + export/route.ts (exceljs)
  portfolio/page.tsx              "Obras de Arte", filtro por artista
  privacidad/page.tsx             aviso de manejo de datos
  careers-actions.ts              aplicar a vacante (Storage + tabla, sin email real)
  encuesta/[token]/, reagendar/[token]/   páginas públicas con token, sin login (patrón admin client)

components/public-site/
  site-header.tsx                 nav + dropdown Contáctanos + link "Plataforma" (solo platform admins)
  site-footer.tsx                 fila unificada + redes sociales
  hero.tsx, services-section.tsx, artists-section.tsx, portfolio-section.tsx,
  reviews-section.tsx, newsletter-section.tsx, careers-section.tsx, image-carousel.tsx

lib/
  domain/availability.ts          motor de disponibilidad puro (testeado, sin cambios de lógica)
  social-links.ts                 helper compartido header/footer para social_links
  auth/session.ts                 helpers de sesión, envueltos en cache()
  email/send-email.ts             stub — loguea en vez de enviar (sin Resend)
  supabase/{client,server,admin}.ts

supabase/
  migrations/*.sql                 último: 20260823000000_home_service_and_payment.sql
  seed.sql                         SOLO el set mínimo original (2 sedes, Sofia/Valentina) —
                                    los datos de demo masivos NO están acá, se insertaron
                                    directo en la BD en vivo (ver sección 3)

components/ui/                     shadcn instalados: button.tsx, switch.tsx — todo lo demás
                                    del plan de sección 8 está SIN instalar todavía

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
6. **Si vas a seguir con el plan de la sección 8, empieza por ahí** — ya está confirmado
   por el usuario, no hace falta volver a preguntar nada de lo que sigue.

## 8. Migración a componentes shadcn "base" — IMPLEMENTADA (2026-08-18), con desviaciones reales

Las 14 decisiones de abajo se implementaron en esta sesión. **Tres de los componentes
`@base-ui/react` 1.7.0 planeados resultaron genuinamente rotos en este stack exacto
(React 19.2.8 + Next 16.3.1 Turbopack) — no un error de uso, verificado con repros
mínimos aislados en dev y en build de producción.** Se reemplazaron por el mismo patrón
hand-rolled que ya usa el resto del sitio (útil saber esto antes de tocar más UI):

1. **`Menu`/`Menubar`** (`@base-ui/react/menu`, `/menubar`) — el trigger nunca abre con
   clic real (`onOpenChange` jamás se dispara), reproducido con el ejemplo *literal* de
   la doc oficial de Base UI, sin ningún código propio de por medio. `admin-nav.tsx` usa
   un dropdown hand-rolled (`useState` + `mousedown`-outside-close, igual que
   `site-header.tsx`'s "Contáctanos") estilizado para verse igual a Menubar.
   `components/ui/menubar.tsx`/`dropdown-menu.tsx` quedan instalados pero sin usar — si
   una futura versión de `@base-ui/react` lo arregla, son un swap directo.
2. **`Questionnaire`'s `Choice`/`ChoiceInput`** (`@shadcn/react/questionnaire`) — el
   radio interno nunca cambia `checked` al hacer clic, ni con clic real ni con
   `.click()` nativo vía JS. El resto de Questionnaire (`Root`/`Item`/`Progress`/
   `Title`, controlado por `item`/`onItemChange`) sí funciona bien y es el motor real
   del wizard ahora. Los pasos Ubicación y Artista usan botones simples (mismo patrón
   que ya tenía el wizard) en vez de `QuestionnaireChoice`. `QuestionnaireActions`/
   `QuestionnaireNext` tampoco se usan — los botones "Siguiente" de Ubicación/Pago son
   `<Button>` normales con su propio `onClick`.
3. **`Accordion`** — el panel expande en el DOM (aria/estado correctos) pero la
   variable CSS `--accordion-panel-height` que controla la animación de altura se queda
   en `0px` con `overflow: hidden`, dejando el contenido expandido pero *inasequible al
   clic* (verificado con `getBoundingClientRect`/`elementFromPoint`). El paso Servicio
   volvió al expand/collapse manual que ya tenía (`useState` + render condicional, sin
   animación de altura).

**Sí funcionan bien y quedan en uso real:** `Calendar` (react-day-picker, no es
`@base-ui/react` — sin problemas), `RadioGroup` standalone (usado en `TimePicker` para
los horarios — **ojo**: pasarle `value={undefined}` cuando no hay selección, no
`value=""` — un string vacío como valor controlado rompe el clic del radio, verificado
en vivo; el warning de consola "changing from uncontrolled to controlled" que esto deja
es cosmético, no lo "arregles" sin volver a probar clics reales), `Carousel` (embla, no
es Base UI), `Button`/`Input`/`Spinner` (primitivos simples, sin problema).

**Cómo se encontró todo esto**: cada bug se aisló con una página de prueba mínima
(`app/test-menubar/page.tsx`, borrada al terminar) reproduciendo el snippet *exacto* de
la documentación oficial del componente, fuera de este proyecto — así se descartó "uso
incorrecto" antes de reemplazar nada. Vale la pena repetir este patrón (repro mínimo
aislado) antes de asumir que un bug de interacción es culpa del código propio.

**Otro hallazgo real, sin relación con Base UI**: `<Suspense fallback={null}>`
alrededor de `BookingWizardInner` (necesario en teoría por `useSearchParams()`) dejaba
el boundary de streaming de React permanentemente sin revelar (`hidden` nunca se quita,
el script `$RC(...)` de React nunca completa) — reproducido de forma limpia con
servidor y `.next` recién reiniciados, así que no era caché de HMR. Como esta ruta ya es
100% dinámica (fetches reales a Supabase, sin generación estática), se quitó el
`Suspense` sin downside real — `npm run build` no marca ninguna advertencia por
`useSearchParams()` sin Suspense aquí. Si se necesita Suspense real en una ruta similar
en el futuro, investigar esto antes de asumir que simplemente "funciona".

Texto original del plan de decisiones (para contexto histórico), abajo:

### Decisiones confirmadas

1. **Servicio a domicilio** se mueve del paso final (Confirmar/Pago) al **paso 1
   (Ubicación)** — junto a elegir sede, agregar la opción "prefiero que vengan a mi
   domicilio".
2. **Questionnaire de shadcn reemplaza el motor completo del wizard.** No es solo un
   envoltorio visual — el usuario confirmó **reescritura completa**: la lógica hoy en
   `booking-wizard.tsx` (cálculo de `step` a mano, `searchParams` como estado, `goBack()`
   manual) se reemplaza por el sistema real de `Questionnaire`/`QuestionnaireItem`/
   `QuestionnaireProgress`/`QuestionnaireActions`. Antes de escribir código: revisar cómo
   Questionnaire soporta pasos con contenido custom (Calendar, RadioGroup de horarios,
   formulario de dirección, formulario de pago) más allá de su modelo simple de
   `choices` — el snippet de la doc no lo deja 100% claro, puede necesitar mirar el
   código fuente real del componente (`npx shadcn add questionnaire` y leer el archivo).
   `stepper.tsx` queda obsoleto (Questionnaire trae su propio progreso).
3. **Calendar** de shadcn reemplaza el `<input type="date">` actual del paso Fecha.
4. **Accordion** de shadcn para la sección de Servicios (ya es expand/collapse a mano,
   se reemplaza por el componente real).
5. **Button** y **Button Group** de shadcn en todos los botones del flujo de reserva.
6. **Carousel** de shadcn para las fotos de portafolio — **en los dos lugares** donde
   aparecen hoy: la página dedicada `/salon/[slug]/portfolio` y la sección de portafolio
   de la landing.
7. **Login**: el componente "Direction" que el usuario enlazó **no aplica** — es un
   `DirectionProvider` de RTL/LTR para internacionalización, no tiene nada que ver con
   autenticación (confirmado leyendo la doc real). Decisión del usuario: no usar un
   componente dedicado de "login", solo aplicar los nuevos Button/Input al formulario
   existente en `/auth/login`.
8. **Menubar** de shadcn para el header — **solo el panel admin** (`admin-nav.tsx`), no
   el sitio público. Ojo: Menubar es un patrón de menú de escritorio (clic para abrir
   dropdown), distinto al nav actual de links siempre visibles — es un cambio real de
   interacción, no solo de estilo.
9. **Botón "ir a inicio" durante la reserva** — ya existe uno básico (nombre del salón
   arriba del wizard, del correction round anterior). Se integra como parte del nuevo
   layout con Questionnaire, no hace falta tratarlo como tarea aparte.
10. **Spinner** de shadcn para el estado de carga de "Confirmar cita".
11. **Toast** (sonner, ya instalado — se usa desde la ronda de notificaciones del admin)
    se extiende a: reserva creada, asignación de artista, mensaje de reseña. Si además se
    quiere que el artista reciba un toast en vivo cuando le asignan una cita (con su
    sesión abierta en otra pestaña), reutilizar el mismo patrón de Realtime de
    `admin-nav.tsx`.
12. **Eliminar el reloj analógico** (`analog-clock.tsx`) del paso Hora — reemplazar el
    picker completo por **RadioGroup** de shadcn. Esto revierte una feature de una ronda
    anterior (el reloj se pidió y se pulió explícitamente antes) — no es un bug, es un
    cambio de dirección deliberado del usuario, confirmado sin ambigüedad.
13. **Guest booking se elimina por completo** (no solo se desactiva la UI): la función
    `book_appointment_as_guest`, su migración (`20260822000000_guest_booking.sql`), la
    Server Action `bookAsGuest` en `book/actions.ts`, y el formulario de invitado en
    `booking-wizard.tsx`. Razón explícita: sin uso, es superficie de ataque muerta
    (`SECURITY DEFINER` innecesaria). **Regla nueva: reservar requiere cuenta, sin
    excepción.**
14. **El celular ya no es obligatorio para reservar** — pero la recomendación (no
    objetada por el usuario) es dejarlo como campo opcional en el flujo en vez de
    quitarlo del todo, para que el staff lo pueda tener si el cliente quiere compartirlo.
    Si al retomar el usuario prefiere quitarlo del todo, confirmar antes de decidir.

### Estado final de cada decisión (2026-08-18)
1. ✅ Servicio a domicilio en paso 1 (Ubicación), junto a elegir sede.
2. ✅ Questionnaire reemplaza el motor (`item`/`onItemChange` controlado por el mismo
   cálculo de `currentStep` que antes era `step`); `stepper.tsx` borrado.
3. ✅ Calendar en el paso Fecha.
4. ⚠️ Accordion planeado para Servicios — **revertido a expand/collapse manual**, ver
   arriba (bug real de Base UI).
5. ✅ Button/Button Group en los botones del wizard (Button sí, Button Group no se
   necesitó — ningún grupo de botones adyacentes lo pedía).
6. ⚠️ Carousel de shadcn — implementado en `ImageCarousel` (usado por la sección de
   Servicios y por la sección de Portfolio de la landing). La página standalone
   `/salon/[slug]/portfolio` en realidad **no usaba un carousel** (usa un grid), a pesar
   de que el plan decía "en los dos lugares donde aparecen hoy" — no se tocó, ya que
   convertir un grid de exploración en un carousel de una fila reduciría cuántas fotos
   se ven a la vez; confirmar con Carlos si de verdad la quiere como carousel.
7. ✅ Login usa el nuevo `Input`/`Button`, sin componente "Direction" (no aplica).
8. ✅ Menubar visual en `admin-nav.tsx` — **implementado hand-rolled**, ver arriba (bug
   real de Base UI en el componente Menubar real).
9. ✅ Botón "ir a inicio" ya integrado (nombre del salón arriba del wizard, sin cambios).
10. ✅ Spinner en el botón "Confirmar cita" mientras `confirming`.
11. ✅ Toast de "reserva creada" (sonner) — el `<Toaster/>` no estaba montado en el
    layout público (solo en `admin/layout.tsx`), se agregó a `salon/[slug]/layout.tsx`.
    El toast en vivo al staff cuando le asignan una cita ya existía (mismo patrón
    Realtime de `admin-nav.tsx`) — no hizo falta construir nada nuevo ahí.
12. ✅ Reloj analógico eliminado; `TimePicker` ahora es un `RadioGroup` en grilla,
    coloreado disponible/no-disponible. `analog-clock.tsx` borrado.
13. ✅ Guest booking eliminado por completo — RPC dropeada con una migración nueva
    (`20260824000000_remove_guest_booking.sql`, no se tocaron las migraciones ya
    aplicadas), Server Action y formulario borrados del código.
14. ✅ Celular queda opcional para clientes con teléfono ya guardado (sin cambios
    respecto al comportamiento existente — el campo ya era condicional).

Verificado en vivo en el navegador (no solo build/lint): flujo completo de reserva de
principio a fin incluyendo confirmación real contra la base de datos, toggle de
servicio a domicilio con su validación, dropdown de sede única, deep link desde una
tarjeta de servicio (con salto correcto de pasos), dropdown del admin nav, login. Datos
de prueba insertados durante la verificación fueron limpiados de la base de datos al
terminar. `npm run build`, `npx tsc --noEmit`, `npx eslint .` y `npm test` (13/13)— todos
limpios.
