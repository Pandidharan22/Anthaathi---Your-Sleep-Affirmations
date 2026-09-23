-- Anthaathi: journal entries (SYSTEM_DESIGN.md §4, FR-603-FR-604)
-- No update policy: entries are treated as immutable, dated records (like
-- playback_sessions) rather than editable documents -- there's no edit UI,
-- and a journal's value as a record of what you thought/felt on a given
-- night is arguably weakened by silently rewritable history. Delete is
-- still allowed (the user's basic right to remove their own private
-- writing), unlike playback_sessions' fully append-only design.

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prompt text,
  body text not null,
  created_at timestamptz not null default now()
);

create index journal_entries_user_id_created_at_idx on public.journal_entries (user_id, created_at);

alter table public.journal_entries enable row level security;

create policy "journal_entries_select_own" on public.journal_entries
  for select using (auth.uid() = user_id);

create policy "journal_entries_insert_own" on public.journal_entries
  for insert with check (auth.uid() = user_id);

create policy "journal_entries_delete_own" on public.journal_entries
  for delete using (auth.uid() = user_id);
