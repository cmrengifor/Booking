# Beauty Salon SaaS — Technical Architecture Proposal

## Status (2026-08-16, superseded — see `docs/HANDOVER.md`)

All 12 phases below were built, verified live, committed, and later
pushed/deployed. Several more rounds of improvements shipped after this
line was written (multi-location booking, wizard redesign, landing page
and footer changes, various bug fixes) — **`docs/HANDOVER.md` is the
up-to-date state of the project; read that first.** This section is kept
for historical context on the original 12-phase build only.

What's genuinely still left, because it can't be done from code: real
pilot-salon data (name, address, real services/staff/photos) to replace
the fictional Atelier Noir seed; a real email provider (Resend) —
blocks "Trabaja con nosotros" email delivery and any future guest
checkout; and a decision on error-monitoring/rate-limiting
infrastructure. See `PRODUCT.md` and `DESIGN.md` (added in Phase 10)
for the product record and the built visual system, respectively.

## Context

Carlos previously built a single-salon booking MVP in this same repo (`nail-salon-booking`) on FastAPI + PostgreSQL + AWS — that build reached a complete, tested V1 (booking engine, staff CRUD, WhatsApp notification scaffolding, Fresha-style landing page). On **2026-08-15 at 18:17**, commit `19f8b42 "reestructuracion"` deleted the entire FastAPI codebase (4,050 lines, zero additions) from this repo, and a new `project/PROJECT_CONTEXT.md` was dropped in describing a **different, larger product**: a true multi-tenant SaaS (many salons, not one salon with multi-tenant-shaped data) on a completely different stack (Next.js/React/TypeScript/Supabase/Vercel instead of FastAPI/Postgres/AWS).

This is a deliberate, already-executed restart, not something this plan needs to decide — the old code is gone from the working tree (still recoverable from git history if ever needed). This plan treats `docs/PROJECT_CONTEXT.md` as the sole source of truth and designs the architecture phase requested: **no application code yet**, just the technical design, explicit tradeoff calls, and a phased build order, per Carlos's explicit instruction ("do not blindly agree... identify contradictions... produce the architecture proposal first").

Several places in PROJECT_CONTEXT.md are genuinely ambiguous or contradictory when held to implementation rigor (Category/Service/Variant depth, the REJECTED status, what happens when a specific-artist request is declined, "no shared customer identity" vs. Supabase Auth being platform-wide). Each is resolved below with a stated rationale and flagged in section H for confirmation, rather than blocking on a question — per Carlos's instruction not to ask unless the answer would materially redirect the architecture.

---

## A. Recommended Architecture — Project Structure

Single Next.js app (App Router), not a monorepo — Platform Admin is a route group, not a separate deployable app (only one operator, Carlos, needs it; a second Vercel project would be pure overhead right now).

```
/
├── app/
│   ├── salon/[slug]/
│   │   ├── layout.tsx            # resolves tenant by slug (404 if missing/inactive), provides SalonContext to everything below
│   │   ├── page.tsx              # public landing: hero/services/portfolio/artists/brands/FAQ/reviews/newsletter/footer
│   │   ├── services/page.tsx
│   │   ├── artists/[artistId]/page.tsx
│   │   ├── portfolio/page.tsx
│   │   ├── book/                 # service -> artist -> datetime -> auth -> confirm
│   │   ├── account/              # customer account, auth-gated, salon-scoped
│   │   │   ├── page.tsx
│   │   │   └── appointments/[id]/page.tsx
│   │   └── admin/                # salon staff dashboard, role-gated
│   │       ├── layout.tsx        # enforces active salon_membership + role
│   │       ├── overview/  calendar/  appointments/  customers/
│   │       ├── staff/  services/  portfolio/  brands/  reviews/
│   │       ├── newsletter/  analytics/  settings/
│   ├── platform-admin/
│   │   ├── layout.tsx            # enforces platform_admins membership
│   │   └── salons/page.tsx
│   ├── auth/  login/  callback/route.ts
├── components/{ui,booking,admin,public-site}/
├── lib/
│   ├── supabase/{client.ts, server.ts, admin.ts}   # admin.ts = service-role, server-only, used sparingly
│   ├── tenant/resolve-salon.ts
│   ├── auth/session.ts           # current user + salon membership + role
│   └── domain/{availability.ts, appointment-state-machine.ts, timezone.ts, analytics.ts}
├── supabase/migrations/          # SQL = source of truth for schema, RLS, RPCs
├── types/database.ts             # generated Supabase types
└── docs/PROJECT_CONTEXT.md
```

**Where business logic lives:** invariants that must hold under concurrent access (no double-booking, no double-assigning an OPEN appointment) live in Postgres as SQL/RPC functions — atomicity there is non-negotiable and can't be safely replicated in application code. Everything else (form validation, notification composition, analytics formatting) lives in TypeScript under `lib/domain/`. This is a deliberate split, not logic duplicated in two languages.

Tenant context is resolved exactly once per request, in `salon/[slug]/layout.tsx`, and threaded down — never re-derived ad hoc in a leaf component.

---

## B. Multi-Tenant Architecture & Database Schema

### Identity model (resolves a real contradiction in the source doc)

PROJECT_CONTEXT.md says a customer must have no identity shared across salons — but Supabase Auth is **one shared instance for the whole platform** (`auth.users` is project-wide, not per-tenant). A single email is inherently one login across every salon. The resolution: the **login** (`profiles`, 1:1 with `auth.users`) is necessarily platform-wide, but every **business record** (booking history, preferences) lives in a `customers` row scoped to `(profile_id, salon_id)`. Nothing about one salon is visible from another — no shared loyalty data, no cross-salon booking history — which is what the requirement is actually protecting against. This is the standard, correct way to satisfy "salon-scoped identity" without needing separate Supabase projects per salon.

### Core tables

| Table | Purpose | PK / key FKs | Notable constraints/indexes |
|---|---|---|---|
| **salons** | Tenant root | `id` uuid pk | `slug` unique not null; `timezone` (IANA string) not null; `cancellation_cutoff_hours` int default 24; `status` enum(active,suspended). CMS scalar fields (`hero_title`, `hero_subtitle`, `hero_image_url`, `footer_text`, `address`, `contact_phone`, `contact_email`, `social_links` jsonb) live directly on this row — no separate 1:1 `site_settings` table, since they're always fetched together. |
| **profiles** | Platform-wide identity, 1:1 with `auth.users` | `id` uuid pk = `auth.users.id` | `full_name`, `avatar_url`, `phone`. Populated via a `handle_new_user()` trigger on `auth.users` insert (standard Supabase pattern). |
| **platform_admins** | Who runs the platform | `profile_id` pk/fk | `granted_by`, `granted_at` — small audit table instead of a bare boolean, cheap and traceable. |
| **salon_memberships** | Staff-to-salon link + role | `id` pk; `salon_id` fk, `profile_id` fk | unique(`salon_id`,`profile_id`); `role` enum(owner,manager,receptionist,stylist); `status` enum(invited,active,disabled); index (`salon_id`,`role`) for "eligible staff" lookups. Role is **per-salon**, not global — a person could be Owner at one salon and nothing at another (architecture stays correct once a second salon exists). |
| **customers** | Salon-scoped customer record | `id` pk; `salon_id` fk, `profile_id` fk not null | unique(`salon_id`,`profile_id`). Created lazily on first booking/registration at that salon, not at platform signup. |
| **artist_profiles** | Public-facing artist page content | `id` pk; `salon_membership_id` fk unique | `display_name`, `bio`, `headshot_url`, `specialties`, `published`, `sort_order`. Separates "who can log in and do what" (`salon_memberships`) from "what the public sees" — resolves the doc's `artists` table, which can't be a standalone entity since artists must also be authenticated staff. |
| **service_categories** | e.g. "Manicure" | `id` pk; `salon_id` fk | `name`, `sort_order`, `active`. |
| **services** | Bookable, priced unit | `id` pk; `salon_id` fk, `category_id` fk | `base_price`, `base_duration_minutes`, `buffer_minutes`, `has_variants` bool. If `has_variants=false`, price/duration are used directly. |
| **service_variants** | Optional price/duration tiers on a service | `id` pk; `service_id` fk, `salon_id` fk (denormalized) | unique(`service_id`,`name`); own `price`/`duration_minutes`/`buffer_minutes`. |
| **salon_weekly_hours** | Salon-level operating hours | `id` pk; `salon_id` fk | `day_of_week`, `open_time`, `close_time`. Outer bound that artist availability is intersected with. |
| **staff_weekly_hours** | Per-artist recurring hours | `id` pk; `salon_membership_id` fk, `salon_id` fk | unique(`salon_membership_id`,`day_of_week`); `start_time`,`end_time`, optional single `break_start`/`break_end` on the same row (multiple breaks/day = V1, not MVP — the doc's example never shows more than one). |
| **staff_time_off** | Vacations/one-off absence | `id` pk; `salon_membership_id` fk, `salon_id` fk | `start_date`,`end_date` (inclusive, all-day granularity — partial-day time off is V1). |
| **appointments** | Central booking record | `id` pk; `salon_id` fk, `customer_id` fk, `service_id` fk, `service_variant_id` fk nullable, `salon_membership_id` fk nullable (NULL while OPEN) | `status` enum(open,pending,confirmed,cancelled,completed,no_show) — **no `rejected` value**, see state machine notes; `starts_at`/`ends_at` timestamptz (duration+buffer baked in at creation); `price` numeric (price **snapshot**, never re-read from `services` later); `amount_paid`, `payment_status`; `artist_preference` enum(specific,any). **`EXCLUDE USING gist (salon_membership_id WITH =, tstzrange(starts_at,ends_at) WITH &&) WHERE (salon_membership_id IS NOT NULL AND status IN ('pending','confirmed'))`** via `btree_gist` — the same double-booking guarantee proven in the FastAPI build, now also the mechanism that protects OPEN-appointment acceptance (see state machine). Indexes: (`salon_id`,`status`,`starts_at`); (`salon_membership_id`,`starts_at`); (`customer_id`,`starts_at`); partial index on `status='open'`. |
| **appointment_events** | Append-only audit log | `id` pk; `appointment_id` fk, `salon_id` fk | `actor_profile_id` nullable (system events), `event_type` enum(created,assigned,accepted,released,declined,rescheduled,cancelled,completed,no_show), `previous_status`,`new_status`, `metadata` jsonb. No client UPDATE/DELETE grants at all — INSERT only via the RPC functions below. |
| **reviews** | Post-appointment rating | `id` pk; `salon_id` fk, `appointment_id` fk **unique**, `customer_id` fk, `salon_membership_id` fk | `rating` smallint check(1-5), `comment`, `status` enum(pending,published,rejected). Unique(`appointment_id`) is the hard backstop against duplicate reviews. |
| **portfolio_items** | General work gallery | `id` pk; `salon_id` fk, `salon_membership_id` fk nullable | `image_url`,`title`,`description`,`published`,`sort_order`. |
| **brands** | Landing-page brand carousel | `id` pk; `salon_id` fk | Small CMS table — explicitly named in the landing composition (§7) and admin nav (§28), trivial to build alongside portfolio; included in MVP even though not itemized in the §32 priority list. |
| **faqs** | Landing-page FAQ | `id` pk; `salon_id` fk | Same reasoning as `brands`. |
| **newsletter_subscribers** | Email capture | `id` pk; `salon_id` fk | unique(`salon_id`,`email`). **Campaigns/templates are explicitly deferred** — the doc itself says "actual email marketing provider integration can be implemented later," and neither appears in the MVP list. |
| **notifications** | In-app + email queue | `id` pk; `salon_id` fk, `recipient_profile_id` fk | `type` enum, `related_appointment_id` fk nullable, `read_at` nullable. INSERT only via RPCs (system-authored). Index (`recipient_profile_id`,`read_at`,`created_at`). |

### Explicitly NOT built for MVP (with reasons)

- **`payments` table** — doc says no online payments in MVP; `appointments.amount_paid`/`payment_status` already capture what analytics needs. Building a payments table now (transaction IDs, refunds, provider webhooks) is exactly the "designing for hypothetical future requirements" the doc warns against — nothing here blocks adding it later.
- **`newsletter_campaigns`/`newsletter_templates`** — see above.
- **Per-artist service restrictions** — doc: "all artists can perform all services," don't build a join table for a restriction that doesn't exist yet.
- **Analytics warehouse / materialized tables** — doc explicitly prefers deriving from transactional data; a handful of plain SQL views is enough at single-salon scale.
- **Slot/availability cache table** — availability is computed live per request; premature at this data volume.

---

## C. Appointment State Machine

**Statuses:** `open`, `pending`, `confirmed`, `cancelled`, `completed`, `no_show`.

**Deliberate deviation from the doc's literal 7-state list:** `REJECTED` is dropped as a stored status. The doc's own diagram (§15) shows CONFIRMED → REJECTED → OPEN happening as one conceptual step ("the appointment becomes available again"), never as a state anything actually queries against. Storing it would mean every rejection produces a moment where the row sits in a dead-end-looking status that must immediately be flipped again. Instead, `released`/`declined` are **event types** on `appointment_events`, and the appointment's `status` column transitions directly. History is fully preserved; the column just never holds a value nobody queries for. *(Flagged in H — this changes a literal enum named in the source doc.)*

| From | Action | To | Actor | Customer-triggerable | Event logged |
|---|---|---|---|---|---|
| — | Book, `artist_preference=specific` | `pending` | customer | yes | `created` |
| — | Book, `artist_preference=any` | `open` | customer | yes | `created` |
| `pending` | Named artist accepts | `confirmed` | stylist (that one), or rec/mgr/own on their behalf | no | `accepted` |
| `pending` | Named artist declines | `cancelled` | stylist (that one) | no | `declined` |
| `pending`/`open` | Customer cancels (cutoff respected) | `cancelled` | customer | yes | `cancelled` |
| `pending`/`open`/`confirmed` | Staff cancels (no cutoff) | `cancelled` | rec/mgr/own | no | `cancelled` |
| `open` | Eligible staff takes it | `confirmed` | stylist or receptionist (doc explicitly gives receptionist "take/open appointments") | no | `assigned` |
| `confirmed` | Assigned artist releases | `open` (if was `any`) / `cancelled` (if was `specific` — nothing to fall back to) | stylist (assigned) | no | `released` |
| `confirmed` | Reschedule (new time, same row) | `confirmed`/`pending` (unchanged) | customer (cutoff), or rec/mgr/own/self-stylist | yes | `rescheduled` |
| `confirmed` | Marked done | `completed` | stylist (assigned)/rec/mgr/own | no | `completed` |
| `confirmed` | Marked no-show | `no_show` | stylist (assigned)/rec/mgr/own | no | `no_show` |

`cancelled`/`completed`/`no_show` are terminal.

**Gap filled that the doc leaves open:** what happens when a *specific*-artist `pending` request is declined? There's no "pool" to fall back to for a request the customer explicitly aimed at one person, so it goes to `cancelled` with an event + customer notification, rather than silently becoming an `open` request for a different artist than the one the customer chose. *(Flagged in H.)*

### Race safety (the doc's specific ask)

Two artists tapping the same OPEN appointment at once is a plain **conditional UPDATE**, not a retry loop:

```sql
update appointments
set status = 'confirmed', salon_membership_id = $artist_membership_id, updated_at = now()
where id = $appointment_id and status = 'open' and salon_membership_id is null
returning *;
```

Zero rows returned = someone else already took it (or a customer cancelled it) → client shows "just taken, pick another" and refreshes the open list. The `EXCLUDE` constraint is the backstop underneath this: if the accepting artist already has a conflicting `pending`/`confirmed` appointment at that time, the UPDATE itself is rejected at the database level even if the application check were somehow bypassed — the same constraint protects both explicit-artist bookings and open-appointment acceptance, since accepting is just an UPDATE that assigns `salon_membership_id`.

**Known, accepted MVP limitation:** because OPEN appointments have `salon_membership_id = NULL`, the EXCLUDE constraint doesn't stop two different customers from both creating an `open` appointment for the same popular slot when only one artist is actually free then. Only one can ultimately be honored; the other needs a human to notice (surfaced in the admin's Open Appointments view, sorted oldest-first) and ask that customer to pick a new time. Building a short-lived hold to prevent this (like the old FastAPI project had) is explicitly *not* what this doc asks for — it says the system must not auto-assign, and a hold would only matter for a window of a few seconds between slot-pick and auth. Flagged in H as a call to confirm, not built by default.

---

## D. RLS / Security Strategy

**Identity primitives** (Postgres functions, `stable`):

```sql
current_profile_id() -> auth.uid()
is_platform_admin() -> exists(select 1 from platform_admins where profile_id = auth.uid())
staff_role_for_salon(p_salon_id) -> role from salon_memberships where salon_id=p_salon_id and profile_id=auth.uid() and status='active'
```

**Rule applied everywhere:** every tenant-owned table carries its own `salon_id` column directly, even where it's technically derivable through a join (e.g. `service_variants`, `staff_weekly_hours`, `appointment_events`). RLS policies then stay a flat `salon_id = ...` check with zero joins — a well-known Supabase performance practice, since RLS predicates run on every row of every query. This is a deliberate denormalization, guaranteed consistent because the FK it mirrors is always set in the same INSERT.

**Critical design point — appointments gets no direct client UPDATE grant at all.** The state machine above has too many actor/transition combinations to express safely as a handful of RLS `USING`/`WITH CHECK` clauses without gaps. Instead: `REVOKE UPDATE ON appointments FROM authenticated`, and every transition goes through a `SECURITY DEFINER` RPC function — `book_appointment`, `accept_open_appointment`, `release_appointment`, `cancel_appointment`, `reschedule_appointment`, `complete_appointment`, `mark_no_show`. Each function re-validates "is this caller allowed to do *this* transition on *this* row" (role + ownership + current status) before writing, and writes the `appointment_events` row in the same transaction — one door in, atomic, and the state machine lives in exactly one place instead of being scattered across policies. `appointment_events` gets the same treatment (no client INSERT grant; RPC-only).

| Table | Public read? | Read (authenticated) | Write |
|---|---|---|---|
| `salons` | Yes, `status='active'` rows | Full row to staff of that salon / platform admin | Owner/manager of that salon, platform admin |
| `salon_memberships` | No | Self, other staff of same salon, platform admin | Owner/manager (invite/remove), platform admin |
| `customers` | No | Self, staff of that salon, platform admin | Self (insert own), staff (walk-ins), platform admin |
| `services`/`categories`/`variants`/`portfolio`/`brands`/`faqs` | Yes, active/published rows | Full to staff of that salon | Owner/manager only (doc explicit for portfolio; extended consistently) |
| `staff_weekly_hours`/`breaks`/`time_off` | No | Self, other staff of same salon, platform admin | Owner/manager (MVP: not self-service, see H) |
| `appointments` | No | Owning customer, staff of that salon, platform admin | **No direct grant — RPCs only** |
| `appointment_events` | No | Owning customer, staff of that salon, platform admin | **No direct grant — RPCs only** |
| `reviews` | Yes, `status='published'` | Full to staff of salon, the reviewing customer, platform admin | Insert via RPC (customer, own completed appointment only); moderate (owner/manager) |
| `notifications` | No | Recipient only | Insert via RPC only; recipient can mark read |
| `newsletter_subscribers` | No | — | Insert public (anon, no auth needed); read/delete owner/manager |
| `platform_admins` | No | Platform admins only | Platform admins only (via a `security definer` helper to avoid the self-referential-policy recursion problem) |

**Analytics views:** must be created with `security_invoker = true` (PG15+, Supabase supports it) so a querying user's own RLS applies — the classic footgun is a view silently running with its creator's (elevated) permissions and leaking cross-tenant data. Flagged explicitly for Phase 11.

---

## E. Booking Availability Engine

Conceptual algorithm, per (salon, service/variant, date, artist_preference):

1. Resolve effective `duration` + `buffer` (variant overrides service if present); `slot_minutes = duration + buffer`.
2. Candidate artists = the one named artist (specific) or every active `stylist`-role membership at the salon (any — no per-artist service filtering, all artists do all services).
3. Per candidate, per day: start from `staff_weekly_hours` for that weekday (no row = day off) → subtract the break window → intersect with `salon_weekly_hours` (salon-level outer bound — added because the doc lists "salon business hours" as an explicit input, which needs its own table, not just artist hours) → subtract `staff_time_off` ranges covering that date → subtract existing `pending`/`confirmed` appointment intervals for that artist that day.
4. Slice remaining free ranges into candidate start times at the salon's slot granularity (default 15 min, configurable — carried over from the prior build) where `[start, start+slot_minutes)` fits entirely inside a free range.
5. **Any-artist mode:** union across candidates — a time is offered if *at least one* artist is free for it. Picking a slot creates the appointment as `open`/`artist_id=NULL` — **no auto-pick of the least-busy artist**, unlike the old FastAPI project's design. This is a deliberate reversal driven by this new spec's explicit "the system MUST NOT assign an artist automatically" rule — flagged in H since it's the opposite of previously-validated behavior.
6. No caching/materialized slots for MVP — recomputed live on each request; cheap at single-salon data volume.

---

## F. Cancellation / Reschedule & Timezone

- `salons.cancellation_cutoff_hours` (default 24, per-salon) — carried over from the prior build's pattern.
- Customer cancel/reschedule allowed only if `starts_at > now() + cutoff_hours` and status is `pending`/`open`/`confirmed`; enforced **inside the RPC function**, never trusted from a client-computed boolean.
- Staff (receptionist/manager/owner) can override the cutoff; every override is logged with actor + `metadata.overridden = true`.
- Reschedule updates `starts_at`/`ends_at` (and optionally `salon_membership_id`) in place on the same appointment row, re-validated against availability and the `EXCLUDE` constraint at the moment of update — same atomicity guarantee as creation.

**Timezone — explicit design, not browser-derived (the doc's own instruction):**
- `salons.timezone` is the single authority (IANA string). All timestamps are `timestamptz` (Postgres stores UTC internally) — never bare `timestamp`.
- `staff_weekly_hours.start_time`/`end_time` are wall-clock `time` values with no zone attached ("9am salon-local"). Converting a calendar date + wall-clock time into an actual instant is always `(date + time) AT TIME ZONE salons.timezone`, never an implicit session/server default. This is the exact bug class already found and fixed once in the FastAPI build (a bare `::timestamptz` cast silently resolved via the DB session's zone instead of the tenant's) — carried forward as a standing rule for every query that touches appointment/slot times.
- Every UI (booking widget, admin calendar) always displays times converted to the *salon's* zone, explicitly labeled — never the visitor's browser zone.

---

## G. Notifications, Reviews, Storage

**Notifications:** `notifications` table (in-app) is fully self-contained and ships in MVP with zero external dependency. Email delivery is a thin `sendEmail(notification)` abstraction — logged/stubbed until a provider key (Resend, or Supabase's SMTP relay) is configured, mirroring exactly the WhatsApp-stub pattern that worked well in the prior build. This isn't a new technology being introduced early — it's the same table/UI shipping now, with the one genuinely external dependency (an email provider account) wired in whenever Carlos is ready, matching the doc's "don't implement an external provider yet unless required."

**Reviews:** insert only via an RPC that checks the caller's `customers` row owns the target appointment and that appointment `status='completed'`, defaulting the new row to `status='pending'`. The `unique(appointment_id)` constraint is the hard backstop against duplicates even if the RPC check were bypassed. Moderation (`pending`→`published`/`rejected`) is owner/manager only. Public landing page reads only `published` rows.

**Storage:** one public bucket (`salon-public-assets`) with a `{salon_id}/{category}/{filename}` path convention, rather than five separate buckets — one consistent Storage RLS policy set (public read; write restricted to owner/manager of the `salon_id` in the path), simpler to manage, no real reason to split by category since none need different access rules. No private buckets needed — nothing in the spec requires customer-private files.

---

## H. Decisions to confirm before implementation

These are the calls made above where PROJECT_CONTEXT.md was ambiguous, silent, or (in one case) directly at odds with proven prior behavior. All 11 were accepted as-is by Carlos on 2026-08-15:

1. **Service depth** — `services` carries price/duration directly; `service_variants` is optional (only for services that actually need price tiers), not a mandatory third level for every service. The doc asks for a literal 3-level model but its own worked example only shows 2.
2. **Dropped the `REJECTED` status** — folded into `appointment_events` as `released`/`declined` event types instead of a stored status the row ever sits in.
3. **Declined specific-artist request → `cancelled`**, not silently reassigned to another artist. The doc doesn't say what happens here at all.
4. **No slot-hold/lock mechanic** for the any-artist flow — accepted as a known MVP limitation (rare double-booked-OPEN case resolved manually by staff) rather than adding TTL-hold complexity the doc doesn't ask for.
5. **Any-artist bookings are never auto-assigned to the least-busy artist** — this directly reverses the prior FastAPI project's resolved design, driven by this doc's explicit "MUST NOT assign automatically" rule.
6. Next.js app lives at the **repo root** (not nested under `/project`); `PROJECT_CONTEXT.md` moved to `/docs`.
7. **Single Next.js app** with a `/platform-admin` route group, not a second deployable app.
8. **One shared Storage bucket** with per-salon folders, not five category buckets.
9. **Newsletter = subscriber capture only** in MVP; campaigns/templates are V1.
10. **Staff schedules are owner/manager-edited only** in MVP — stylists don't self-edit their own hours/time-off yet (doc's "manage their own profile if allowed by permissions" is ambiguous about whether that extends to scheduling).
11. **Brands/FAQs included in MVP** as small CMS tables (named in the landing composition) even though not itemized in the doc's own MVP priority list.

---

## MVP / V1 / Future

**MVP:** Auth (Google + email) · salons/profiles/memberships/customers · services (category→service, optional variants) · artist public profiles · staff + salon weekly hours, time-off (single break/day) · live availability engine · booking (specific + any-artist, race-safe) · staff appointment management (take/release/cancel/complete/no-show) · customer account (profile, upcoming/history, reschedule, cancel) · 24h configurable cutoff · completion + amount-paid capture, no online payment · in-app + stubbed-email notifications · reviews with moderation · public website/CMS (hero, services, portfolio, artists, brands, FAQ, reviews, newsletter capture, footer) · basic analytics via SQL views · minimal Platform Admin (salon list, suspend/activate).

**V1:** Newsletter campaigns/templates + real send provider · stylist self-service scheduling · richer analytics (peak-hour heatmap, cohort charts) · auto-expiring stale OPEN appointments · multi-shift/multiple-breaks-per-day.

**Future (per doc, unchanged):** online deposits/payments (Stripe) + refunds, SMS/WhatsApp, push notifications, custom domains, subscription/billing for the platform itself, AI insights, configurable fine-grained permissions, multi-location salons.

---

## Implementation Roadmap

- **Phase 0 — Foundation:** clean repo root, Next.js scaffold, Supabase project, Vercel link, luxury design tokens (black/white/gold, serif+editorial), CI basics.
- **Phase 1 — Database & Auth core:** `salons`, `profiles` (+trigger), `platform_admins`, `salon_memberships`, `customers` + RLS helper functions.
- **Phase 2 — Tenant & Roles:** slug→salon layout/middleware, role-check helpers, protected route groups, RLS on the Phase 1 tables.
- **Phase 3 — Services & Staff:** categories/services/variants, artist_profiles, staff/salon weekly hours + time off, admin CRUD UI.
- **Phase 4 — Availability Engine:** pure-TS implementation + tests against seeded schedules, before any booking UI exists.
- **Phase 5 — Booking:** `appointments`/`appointment_events`, EXCLUDE constraint, all RPC functions, public booking flow UI.
- **Phase 6 — Customer Account:** profile, upcoming/history, reschedule, cancel — reusing Phase 5's RPCs.
- **Phase 7 — Staff/Admin Dashboard:** calendar, appointments list, open-appointments feed, customers view.
- **Phase 8 — Notifications:** table + RPC-triggered inserts, in-app UI, email abstraction.
- **Phase 9 — Reviews:** submission flow (gated on completed), moderation UI, public display.
- **Phase 10 — Public Website/CMS:** full landing page, Storage bucket + policies, admin CMS forms.
- **Phase 11 — Analytics:** `security_invoker` SQL views, KPI dashboard.
- **Phase 12 — Production hardening:** manual cross-tenant RLS audit, rate-limiting public endpoints, error monitoring, real pilot-salon seed data, deploy.

## Verification

No code exists yet by design (architecture-only phase). Once Phase 1 lands, verification means: seed two salons + two staff memberships and manually confirm (via the Supabase SQL editor, logged in as each role through `supabase.auth`) that cross-tenant `SELECT`s return zero rows — this is the load-bearing test for the whole security model and should be repeated after every phase that adds a table.

## Supabase project

- Project ref: `lrketeehpcgypljducau` ("cmrengifor's Project"), region `us-west-2`, Postgres 17.6.1.
- Region flagged for review before production (LatAm salon → `us-west-2` adds avoidable latency vs. a closer region), not blocking for development.
