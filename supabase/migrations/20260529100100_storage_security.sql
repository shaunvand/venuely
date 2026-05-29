-- Tighten venue-media storage object policies (see 20260513150000_venue_media_bucket.sql).
-- Public READ stays open — the portal + public listing need to render images.
-- INSERT/UPDATE/DELETE are scoped so a user may only write objects whose path's
-- first folder segment is a venue they belong to. Object paths are laid out as
-- `<venue_id>/...`, so (storage.foldername(name))[1] is the owning venue id.
-- The service-role key bypasses RLS entirely, so server-side / seed uploads are unaffected.

-- Public read — unchanged, kept here so the bucket's read policy is self-contained.
drop policy if exists "venue-media public read" on storage.objects;
create policy "venue-media public read" on storage.objects
  for select using (bucket_id = 'venue-media');

drop policy if exists "venue-media authed write" on storage.objects;
create policy "venue-media authed write" on storage.objects
  for insert with check (
    bucket_id = 'venue-media'
    and auth.role() = 'authenticated'
    and (
      is_owner()
      or (storage.foldername(name))[1]::uuid in (
        select venue_id from venue_members where user_id = auth.uid()
      )
    )
  );

drop policy if exists "venue-media authed update" on storage.objects;
create policy "venue-media authed update" on storage.objects
  for update using (
    bucket_id = 'venue-media'
    and auth.role() = 'authenticated'
    and (
      is_owner()
      or (storage.foldername(name))[1]::uuid in (
        select venue_id from venue_members where user_id = auth.uid()
      )
    )
  );

drop policy if exists "venue-media authed delete" on storage.objects;
create policy "venue-media authed delete" on storage.objects
  for delete using (
    bucket_id = 'venue-media'
    and auth.role() = 'authenticated'
    and (
      is_owner()
      or (storage.foldername(name))[1]::uuid in (
        select venue_id from venue_members where user_id = auth.uid()
      )
    )
  );
