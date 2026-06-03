-- Guest RSVP invites + white-label RSVP website.
alter table guests add column if not exists rsvp_token uuid not null default gen_random_uuid();
create unique index if not exists guests_rsvp_token_uidx on guests(rsvp_token);
alter table guests add column if not exists invited_at timestamptz;
alter table guests add column if not exists responded_at timestamptz;
alter table guests add column if not exists party_size int;
alter table guests add column if not exists rsvp_message text;
alter table guests add column if not exists rsvp_image_url text; -- storage path in wedding-files
-- Per-wedding white-label RSVP site customisation (headline, message, accent, cover, deadline, togggles).
alter table weddings add column if not exists rsvp_settings jsonb not null default '{}'::jsonb;
