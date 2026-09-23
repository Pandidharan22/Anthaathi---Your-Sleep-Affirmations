-- Anthaathi: playback session log for streak derivation (SYSTEM_DESIGN.md §4, FR-601-FR-602)
-- Append-only: only select/insert policies exist (no update/delete) so a
-- session, once logged, can't be edited or removed by the client -- streaks
-- are derived from this log, so its integrity shouldn't depend on trusting
-- the client not to rewrite history. auth.users' own cascade delete (see
-- the account-deletion migration) is still how a session ever disappears.

create table public.playback_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  played_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0)
);

create index playback_sessions_user_id_played_at_idx on public.playback_sessions (user_id, played_at);

alter table public.playback_sessions enable row level security;

create policy "playback_sessions_select_own" on public.playback_sessions
  for select using (auth.uid() = user_id);

create policy "playback_sessions_insert_own" on public.playback_sessions
  for insert with check (auth.uid() = user_id);
