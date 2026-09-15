-- Lets an existing user start onboarding again (e.g. "Create workspace" from
-- the workspace switcher, or switching account type mid-setup). A completed
-- draft can't be reopened through RLS, so this resets it with definer rights,
-- scoped strictly to the caller's own row.
create or replace function public.restart_onboarding(p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_type not in ('brand', 'agency', 'business', 'creator', 'supplier') then
    raise exception 'invalid account type' using errcode = '22023';
  end if;
  insert into public.onboarding_drafts (user_id, account_type)
  values (auth.uid(), p_type)
  on conflict (user_id) do update
    set account_type = excluded.account_type,
        data = '{}'::jsonb,
        current_step = 1,
        status = 'in_progress',
        workspace_id = null,
        supplier_id = null,
        completed_at = null;
end;
$$;

revoke all on function public.restart_onboarding(text) from public, anon;
grant execute on function public.restart_onboarding(text) to authenticated;

-- account_type is a preference (which flow to show), not a privilege; users
-- with several workspaces legitimately change it. Keep only the admin guard.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
as $$
begin
  if not public.is_end_user_request() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_platform_admin := false;
    return new;
  end if;
  if new.is_platform_admin is distinct from old.is_platform_admin then
    raise exception 'is_platform_admin can only be changed by the platform' using errcode = '42501';
  end if;
  return new;
end;
$$;
