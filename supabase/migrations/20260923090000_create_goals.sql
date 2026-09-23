-- Anthaathi: goals / vision board (SYSTEM_DESIGN.md §4, FR-401-FR-404)
-- Optional goal images live in the 'goal-images' Storage bucket, keyed by
-- {user_id}/{goal_id} -- deterministic so a replaced image just overwrites
-- the same object (upsert) instead of needing an explicit delete-then-upload.

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  image_path text,
  status text not null default 'active' check (status in ('active', 'achieved')),
  created_at timestamptz not null default now(),
  achieved_at timestamptz,
  -- FR-404: achieved_at is set exactly when a goal is marked achieved, never independently
  constraint goals_achieved_at_matches_status check (
    (status = 'achieved') = (achieved_at is not null)
  )
);

create index goals_user_id_idx on public.goals (user_id);

alter table public.goals enable row level security;

create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);

create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);

create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);

-- Storage bucket for optional vision-board images. Not opt-in like audio
-- backup (ADR-0004) -- that decision was about voice-recording privacy,
-- which doesn't apply to a vision-board image the user already chose to add.
insert into storage.buckets (id, name, public)
values ('goal-images', 'goal-images', false)
on conflict (id) do nothing;

create policy "goal_images_select_own" on storage.objects
  for select using (bucket_id = 'goal-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "goal_images_insert_own" on storage.objects
  for insert with check (bucket_id = 'goal-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "goal_images_update_own" on storage.objects
  for update using (bucket_id = 'goal-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'goal-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "goal_images_delete_own" on storage.objects
  for delete using (bucket_id = 'goal-images' and (storage.foldername(name))[1] = auth.uid()::text);
