-- Venue review of couple submissions: status pipeline + reviewed timestamp.
alter table submissions
  add column if not exists status      text not null default 'pending',
  add column if not exists reviewed_at timestamptz;
