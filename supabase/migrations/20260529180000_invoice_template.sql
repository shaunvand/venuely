-- Invoice design: which of the 4 invoice templates the venue uses on the EFT
-- invoice couples receive, plus a small theme (accent colour + logo override).
alter table venues
  add column if not exists invoice_template text,
  add column if not exists invoice_theme    jsonb;
