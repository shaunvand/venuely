-- Couple files: documents (contracts, proof-of-payment) + inspiration images.
-- Stored in a PRIVATE storage bucket; served via short-lived signed URLs.
create table if not exists wedding_documents (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  label text, file_path text not null, mime_type text,
  uploaded_by text default 'couple', created_at timestamptz not null default now()
);
create table if not exists wedding_inspiration (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  file_path text not null, note text, created_at timestamptz not null default now()
);
create index if not exists wedding_documents_wid on wedding_documents(wedding_id);
create index if not exists wedding_inspiration_wid on wedding_inspiration(wedding_id);
alter table wedding_documents enable row level security;
alter table wedding_inspiration enable row level security;

-- Private bucket (no public read; we serve via signed URLs from the service role).
insert into storage.buckets (id, name, public) values ('wedding-files','wedding-files',false)
on conflict (id) do nothing;
