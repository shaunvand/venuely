-- Subscribable venue calendar: a per-venue secret token for the .ics feed URL.
alter table venues add column if not exists ical_token uuid not null default gen_random_uuid();
