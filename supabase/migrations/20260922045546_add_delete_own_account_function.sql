-- FR-104, NFR-205: let a signed-in user delete their own account and all data.
-- folders/affirmations already cascade-delete via their user_id FK's
-- `on delete cascade` (see 20260921123115_create_folders_and_affirmations.sql),
-- so deleting the auth.users row is the only remote work needed.
--
-- SECURITY DEFINER so an authenticated (non-admin) client can trigger a deletion
-- from auth.users, which it otherwise has no privilege to touch directly. Always
-- operates on auth.uid() — never accepts a target id — so it can only ever delete
-- the caller's own account. search_path is pinned to block search_path hijacking
-- of this elevated-privilege function.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
