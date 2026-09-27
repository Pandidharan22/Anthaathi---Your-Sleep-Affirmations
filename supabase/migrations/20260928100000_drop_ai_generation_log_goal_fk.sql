-- Anthaathi: fix a real bug found while manually verifying step 3.3.
-- ai_generation_log.goal_id had a foreign key to public.goals, but goals are
-- local-first (SQLite immediately, Postgres only once the background sync
-- queue drains) -- drafting an affirmation right after creating a goal (an
-- entirely normal sequence) can race ahead of that sync, so the goal_id the
-- Edge Function is given doesn't exist in Postgres yet. The insert then
-- silently failed the FK check, under-counting the rate limit and leaving a
-- gap in the very history log SYSTEM_DESIGN.md §4 describes this table for.
-- goal_id is a best-effort correlation for a user's own history/debugging,
-- not a relation that needs strict integrity, so the fix is to drop the FK
-- rather than force the client to block drafting until a goal has synced.

alter table public.ai_generation_log
  drop constraint ai_draft_requests_goal_id_fkey;
