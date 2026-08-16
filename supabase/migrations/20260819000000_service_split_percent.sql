-- Per-service artist/business revenue split, decided per-service (not a
-- salon-wide default) so different service types can carry different
-- splits. The salon's share is always the remainder (100 - artist_split).
alter table services
  add column artist_split_percent smallint not null default 50
    check (artist_split_percent between 0 and 100);

comment on column services.artist_split_percent is 'Percentage of this service''s price the assigned artist earns; the salon keeps the remainder. Owner/manager-editable.';
