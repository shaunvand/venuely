-- Couple-portal design: which of the built-in templates a venue has chosen, plus
-- a small theme blob (brand primary/accent colours + logo) the portal renders in.
-- Both nullable with sensible app-side defaults ('classic' + Poppy) so existing
-- venues keep working until they pick a design.

alter table venues
  add column if not exists portal_template text,
  add column if not exists portal_theme    jsonb;
