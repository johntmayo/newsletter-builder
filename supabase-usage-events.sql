-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Logs builder usage events (copy for email / print) so tool usage can be
-- counted exactly, without relying on Google Analytics or tracking recipients.

create table if not exists builder_usage_events (
  id bigint generated always as identity primary key,
  event text not null,
  zone text,
  items_selected integer,
  zone_updates integer,
  style_preset text,
  created_at timestamptz not null default now()
);

comment on table builder_usage_events is 'One row per Copy-for-email / Print click in the newsletter builder.';

-- Handy queries:
--   Usage by zone:    select zone, event, count(*) from builder_usage_events group by 1, 2 order by 1;
--   Usage by month:   select date_trunc('month', created_at) as month, event, count(*) from builder_usage_events group by 1, 2 order by 1;
