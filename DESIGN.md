# Design

<!-- impeccable:design-schema 1 -->

Written from the built world (the public salon site, `app/salon/[slug]/`), not authored ahead of it. Established as an **extension** of the tokens already in code since Phase 0 (Fraunces/Inter/gold, black-white-gold) — those predate this file and this file documents them, it did not invent them. Applies to: the landing page AND the booking wizard (`app/salon/[slug]/book/`) — both are customer-facing and carry the premium positioning PRODUCT.md names as the core differentiator. The staff/customer utility screens (admin, account, auth) intentionally stay plainer, per the brief's own MVP philosophy of shipping the booking core before visual polish everywhere.

## Palette

Restrained strategy: near-black/white neutrals carry the page, one committed accent (gold) marks price, emphasis, and interactive affordance — never decoration for its own sake.

- `--background` / `--foreground`: nearly-pure white / near-black (oklch), swap in dark mode.
- `--gold`: `#b4903f` light / `#c9a75a` dark — prices, focus rings, dividers, active accents, ::selection, scrollbar thumb. Never used for large fills; it marks, it doesn't cover.
- Full-bleed black sections (portfolio) invert the palette rather than tinting it — black background, white text, same gold accent.

## Type

- **Fraunces** (serif, `font-heading`) — display only: salon name, section headings, pull-quote reviews. Set in italic for the wordmark/hero treatment.
- **Inter** (`font-sans`) — everything else: body copy, nav, buttons, form fields.
- **Geist Mono** (`font-mono`) — prices and durations only ("$40 · 60 min"), a deliberate small tabular-figures moment, not a general "technical" costume.
- No kicker/eyebrow labels above headings anywhere on this surface — banned by craft-floor, and the heading carries its own weight without one.

## Composition

- **Hero**: full-bleed photograph, bottom-anchored content (not centered), large italic Fraunces wordmark over a black gradient scrim. The photo IS the first-viewport thesis — a real manicure/hand shot, not an abstract mood image.
- **Services**: editorial two-column list (category name left, priced list right with divider rules) — explicitly not icon+heading+text cards.
- **Portfolio**: asymmetric grid (every third tile runs tall) on a full-bleed black section — not a uniform square-card gallery.
- **Artists**: alternating photo/text rows, generous whitespace, no card chrome (no border, no shadow, no background fill separating one artist from the page).
- **Brands**: text wordmarks only (no logo assets), quiet and secondary — a trust signal, not a feature.
- **Reviews**: pull-quote style (large italic Fraunces quote + small attribution), not star-rating boxes.
- **FAQ**: native `<details>/<summary>` accordion.
- **Newsletter**: single inline band, not a boxed card.

## Motion

One grammar, applied everywhere via `components/public-site/reveal.tsx`: sections fade up (opacity 0→1, translateY 24px→0) on scroll-into-view via IntersectionObserver, 900ms exponential ease-out. No per-element hover effects beyond native link/button states and a slow portfolio-image scale on hover.

## Browser surfaces

`::selection`, scrollbar thumb/track, and focus rings are all themed to `--gold` in `app/globals.css` — deliberately, since these are the cheapest signal a page was built rather than assembled, and the check craft-floor calls out as most commonly skipped.

## Known gaps (accepted for MVP)

- Placeholder imagery is real, verified stock photography (Unsplash), not the real pilot salon — swap when real photos exist, per `PRODUCT.md`'s standing "no fabricated content" rule (this is placeholder, not a fabricated claim).
- No comp-led build: image generation isn't available in this environment, so this was built code-led per the impeccable workflow's own fallback — ambition lived in direct iteration against real screenshots, not a locked reference comp.
- Full multi-agent finish-review/documenter ceremony (the shipped subagents) wasn't run as literally specified; this file substitutes a direct self-review pass (live desktop/mobile inspection, a real bug found and fixed — Next.js `deviceSizes` rejecting a legitimately-computed mobile image width — console-error-clean at both breakpoints).
