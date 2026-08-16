-- Improvements batch: artist "about me" / interests, and tagging portfolio
-- photos with the service they showcase (so the landing page can pull
-- service-specific photos from artist portfolios).

alter table artist_profiles
  add column about_me text,
  add column interests text[] not null default '{}';

alter table portfolio_items
  add column service_id uuid references services (id) on delete set null;

create index portfolio_items_service_id_idx on portfolio_items (service_id) where service_id is not null;
