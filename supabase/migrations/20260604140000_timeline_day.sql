-- Per-day wedding timeline (weddings can run 1..several days).
alter table wedding_timeline add column if not exists event_date date;
