-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Holds the single "current issue" JSON for the public newsletter builder.

create table if not exists newsletter_current (
  id smallint primary key default 1 check (id = 1),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table newsletter_current is 'Singleton row (id=1): parsed newsletter JSON served to all site visitors.';
