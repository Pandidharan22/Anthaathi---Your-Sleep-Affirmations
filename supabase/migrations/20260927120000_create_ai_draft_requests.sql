-- Anthaathi: per-user rate-limit log for the generate-affirmation Edge
-- Function (SYSTEM_DESIGN.md §5, FR-501, FR-504). Protects the shared
-- free-tier Groq quota from any single user (bug or abuse), per ADR-0003.
--
-- Write-only from the Edge Function's admin client (which bypasses RLS) --
-- deliberately no insert/update/delete policy for 'authenticated', so a
-- client can never fabricate or erase its own rate-limit history. Select is
-- allowed for the owner in case a future "drafts remaining today" UI wants it.

create table public.ai_draft_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  created_at timestamptz not null default now()
);

create index ai_draft_requests_user_id_created_at_idx on public.ai_draft_requests (user_id, created_at desc);

alter table public.ai_draft_requests enable row level security;

create policy "ai_draft_requests_select_own" on public.ai_draft_requests
  for select using (auth.uid() = user_id);
