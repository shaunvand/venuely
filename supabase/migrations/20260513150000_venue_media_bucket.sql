-- Public bucket for venue catalogue / rental / accommodation images.
insert into storage.buckets (id, name, public)
values ('venue-media', 'venue-media', true)
on conflict (id) do update set public = true;

-- Anyone can read (public bucket); only authenticated users can upload/update/delete their venue's files.
drop policy if exists "venue-media public read" on storage.objects;
create policy "venue-media public read" on storage.objects
  for select using (bucket_id = 'venue-media');

drop policy if exists "venue-media authed write" on storage.objects;
create policy "venue-media authed write" on storage.objects
  for insert with check (bucket_id = 'venue-media' and auth.role() = 'authenticated');

drop policy if exists "venue-media authed update" on storage.objects;
create policy "venue-media authed update" on storage.objects
  for update using (bucket_id = 'venue-media' and auth.role() = 'authenticated');

drop policy if exists "venue-media authed delete" on storage.objects;
create policy "venue-media authed delete" on storage.objects
  for delete using (bucket_id = 'venue-media' and auth.role() = 'authenticated');
