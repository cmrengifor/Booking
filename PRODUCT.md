# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router) + React + TypeScript + Tailwind v4 + shadcn/ui (base-nova, neutral). Backend: Supabase (Postgres, Auth with Google + email/password, Storage). Deployed on Vercel, repo on GitHub. Already implemented (Phase 0 of the build roadmap is done) — this is a confirmed existing choice, not delegated or open.

## Users

Two primary audiences, across different surfaces of the same product:

1. **Salon clients** — the end customers of a premium/boutique nail salon (women-oriented premium positioning). They browse a salon's public site, book an appointment (specific artist or "any available"), manage their account, reschedule/cancel, and leave a review after a completed visit.
2. **Salon staff** — Owner, Manager, Receptionist, Stylist (roles scoped per salon). They manage the calendar, take or release "open" appointments, complete/no-show appointments, manage services/staff schedules/portfolio/reviews, and edit the salon's public website content (lightweight CMS).

A third, minimal audience exists but is out of near-term scope: **Platform Admin**, the SaaS operator (Carlos) managing salons as tenants platform-wide.

## Product Purpose

A multi-tenant SaaS booking platform for premium beauty salons. Ships first for one real pilot nail salon, but is architected from day one to support many salons as isolated tenants (own public site, own booking widget, own staff dashboard, own data — enforced by database-level tenant isolation, not just app-level filtering). Success is a real salon owner adopting it in place of a generic marketplace listing, and their clients booking without friction.

## Positioning

The differentiator is not a channel (an earlier version of this product was positioned as WhatsApp-native for LatAm; that angle is explicitly deferred to "Future" in the current brief, not the current mechanism). The current positioning is the **premium boutique experience itself**: a genuinely luxury visual and booking experience per salon — black/white/gold palette, elegant serif typography, editorial-quality photography, spacious sophisticated layout — versus the generic, template-like presentation of multi-salon marketplaces like Booksy, Fresha, or Vagaro.

## Operating Context

- Booking flow: select service → artist preference (specific artist, or "any available") → date/time → authenticate → confirm.
- **"Any artist" bookings are never auto-assigned.** They're created as an unassigned `open` appointment; eligible staff see it in an open-appointments feed and claim it. This is a deliberate, race-safe mechanic (a plain conditional UPDATE plus a Postgres EXCLUDE constraint backstop) — not an implementation detail, a core piece of how the product behaves.
- Staff work from a calendar: take/release open appointments, cancel, mark completed (recording amount paid — no online payment in MVP) or no-show.
- Customers self-serve reschedule/cancel up to a salon-configurable cutoff (24h default); staff can override the cutoff.
- Every salon has its own IANA timezone; all scheduling logic and display is explicit about it, never inferred from a visitor's or server's local timezone.
- Reviews are gated to completed appointments (one per appointment), attributed to the completing artist, and moderated before appearing publicly.

## Capabilities and Constraints

- Multi-tenant via a `salon_id` column on every tenant-owned table, enforced by Postgres Row Level Security — not application-level filtering alone.
- Auth via Supabase (Google OAuth + email/password); roles are per-salon (Owner/Manager/Receptionist/Stylist), separate from the platform-wide Platform Admin flag.
- Services follow category → service, with *optional* price/duration variants (not every service needs a variant tier).
- Public-site CMS covers hero, services, portfolio, artist profiles, brand carousel, FAQ, newsletter-signup capture, and footer — editable by Owner/Manager without a developer.
- No online payments in MVP (amount paid is recorded manually at completion). No real WhatsApp/SMS/push notifications yet — notifications are in-app plus a stubbed/pending email path.
- Full database schema, RLS policy strategy, appointment state machine, and availability-engine algorithm are already designed and approved — see `docs/ARCHITECTURE.md`; treat it as authoritative for anything structural.

## Brand Commitments

- No real salon brand is confirmed yet (name, logo, real photography, real address). By Carlos's explicit choice, design and build work proceeds with a **fictional placeholder salon brand** until a real pilot salon is onboarded — swapping it in later is a data change, not an architecture change, since every salon is tenant data.
- The visual direction itself *is* a binding constraint from the brief, independent of which salon's data is showing: black / white / gold luxury palette, elegant serif display typography, editorial-quality photography, spacious and sophisticated layout. Explicitly not a generic, template-like beauty-salon look.
- Already implemented in code (Phase 0): Fraunces (serif, headings) + Inter (body) fonts, and a `--gold` token (`#b4903f` light / `#c9a75a` dark) wired into the Tailwind/shadcn theme.

## Evidence on Hand

- `docs/PROJECT_CONTEXT.md` — the original product brief, source of truth for business requirements.
- `docs/ARCHITECTURE.md` — the approved technical architecture (schema, RLS strategy, appointment state machine, availability engine, MVP/V1/Future split, phased roadmap).
- No real salon content exists yet: no real name, address, staff photos, service list, pricing, or testimonials. Future work must not fabricate real customer names, reviews, press mentions, or benchmarks — placeholder/generic content only until the real pilot salon's data replaces it.

## Product Principles

1. Tenant isolation and authorization are load-bearing, not cosmetic — every surface, including visual/CMS work, respects salon boundaries.
2. Ship the reliable booking core before visual polish, per the brief's own MVP philosophy — but the visual layer still may not read as a generic template once it's built.
3. Design for one salon's product surface; architect for many. Nothing in the UI should assume a permanently single-tenant world, even while only one salon is live.
4. No fabricated content. Real photography, testimonials, and pricing wait for the real pilot salon; anything shown before then is placeholder, not a finished claim.
5. The "any artist" open-appointment mechanic and its race-safety are product truth, not an implementation detail — the UI must make that state legible to both clients and staff, not hide it behind generic "pending" language.
