-- Fix: the couple file-upload route (app/api/wedding/[slug]/files/[kind]/route.ts)
-- inserts into wedding_documents with file_path + mime_type, but the table was
-- first created in 20260514120000_phase1_foundation.sql with a `url` column and
-- NO file_path. The later 20260603190000_files.sql used CREATE TABLE IF NOT
-- EXISTS, which was a no-op against the pre-existing table — so file_path/mime_type
-- were never added and the upload failed with:
--   "Could not find the 'file_path' column of 'wedding_documents' in the schema cache".
--
-- Bring the table in line with what the code actually uses: add file_path +
-- mime_type, and relax the legacy NOT NULLs the new code never sets.
alter table wedding_documents add column if not exists file_path text;
alter table wedding_documents add column if not exists mime_type text;
alter table wedding_documents alter column url drop not null;
alter table wedding_documents alter column label drop not null;

-- Reload PostgREST's schema cache so the new columns are visible immediately.
notify pgrst, 'reload schema';
