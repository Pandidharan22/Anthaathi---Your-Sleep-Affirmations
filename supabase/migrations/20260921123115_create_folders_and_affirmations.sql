-- Anthaathi: folders + affirmations metadata (SYSTEM_DESIGN.md §4)
-- Audio bytes live on-device; these tables hold synced metadata only.

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index folders_user_id_idx on public.folders (user_id);

alter table public.folders enable row level security;

create policy "folders_select_own" on public.folders
  for select using (auth.uid() = user_id);

create policy "folders_insert_own" on public.folders
  for insert with check (auth.uid() = user_id);

create policy "folders_update_own" on public.folders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "folders_delete_own" on public.folders
  for delete using (auth.uid() = user_id);

create table public.affirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null,
  local_uri text not null,
  storage_path text,
  duration_ms integer not null check (duration_ms >= 0),
  source text not null check (source in ('recorded', 'ai_generated')),
  voice_id text,
  script_text text,
  created_at timestamptz not null default now(),
  -- FR-514: an ai_generated row must carry the voice + script needed to re-synthesize it
  constraint affirmations_ai_generated_has_voice_and_script check (
    source <> 'ai_generated' or (voice_id is not null and script_text is not null)
  )
);

create index affirmations_user_id_idx on public.affirmations (user_id);
create index affirmations_folder_id_idx on public.affirmations (folder_id);

alter table public.affirmations enable row level security;

create policy "affirmations_select_own" on public.affirmations
  for select using (auth.uid() = user_id);

create policy "affirmations_insert_own" on public.affirmations
  for insert with check (auth.uid() = user_id);

create policy "affirmations_update_own" on public.affirmations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "affirmations_delete_own" on public.affirmations
  for delete using (auth.uid() = user_id);
