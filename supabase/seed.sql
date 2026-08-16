-- Fictional placeholder salon (per PRODUCT.md — swapped for the real pilot
-- salon's data later; nothing here is a real business).
insert into salons (slug, name, timezone, hero_title, hero_subtitle, footer_text, address, contact_phone, contact_email)
values (
  'atelier-noir',
  'Atelier Noir',
  'America/Bogota',
  'Atelier Noir',
  'A quiet, precise kind of luxury.',
  '© Atelier Noir. Placeholder content — Phase 10.',
  'Placeholder address — Phase 10',
  '+57 000 000 0000',
  'hello@atelier-noir.example'
)
on conflict (slug) do nothing;
