-- AI-assigned course / event part for catalogue items (Breakfast, Lunch, Dinner,
-- Drinks & Bar, etc.) so the couple portal can group the menu by part of the day.
alter table catalogue_items add column if not exists event_part text;
