create table modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null, title text not null,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module_id uuid references modules(id) on delete restrict,
  title text not null, body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note_id uuid not null references notes(id) on delete cascade,
  original_path text not null, display_path text not null, thumb_path text not null,
  mime text not null, original_bytes int not null, display_bytes int not null,
  width int, height int, caption text default '', alt_text text default '',
  status text not null default 'ready',
  created_at timestamptz not null default now()
);
create index on notes (user_id, module_id);
create index on attachments (note_id);

alter table modules enable row level security;
alter table notes enable row level security;
alter table attachments enable row level security;
create policy own_modules on modules for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_notes on notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_attachments on attachments for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);
create policy own_files_read on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy own_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy own_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
