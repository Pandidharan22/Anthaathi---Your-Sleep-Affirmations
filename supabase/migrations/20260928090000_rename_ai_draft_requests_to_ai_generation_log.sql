-- Anthaathi: correction to step 3.2's ai_draft_requests table -- SYSTEM_DESIGN.md
-- §4's data model already documents this exact entity as `ai_generation_log`,
-- with prompt_used/result_text for "the user's own history/debugging". Step
-- 3.2 missed that and invented a narrower rate-limit-only table instead of
-- reusing it; this migration folds the two back into the one documented
-- entity rather than carrying both forward.

alter table public.ai_draft_requests rename to ai_generation_log;

alter index ai_draft_requests_user_id_created_at_idx
  rename to ai_generation_log_user_id_created_at_idx;

drop policy "ai_draft_requests_select_own" on public.ai_generation_log;

create policy "ai_generation_log_select_own" on public.ai_generation_log
  for select using (auth.uid() = user_id);

alter table public.ai_generation_log
  add column prompt_used text not null default '',
  add column result_text text not null default '';

alter table public.ai_generation_log
  alter column prompt_used drop default,
  alter column result_text drop default;
