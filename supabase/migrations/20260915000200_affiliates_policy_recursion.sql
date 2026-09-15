-- affiliates_select referenced public.affiliates inside its own USING clause,
-- which Postgres rejects at query time ("infinite recursion detected in
-- policy"), so every affiliates/affiliate_referrals read failed. Resolve the
-- caller's affiliate id through a SECURITY DEFINER helper instead.
create or replace function public.my_affiliate_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.affiliates where user_id = auth.uid()
$$;

revoke all on function public.my_affiliate_id() from public, anon;
grant execute on function public.my_affiliate_id() to authenticated;

drop policy if exists "affiliates_select" on public.affiliates;
create policy "affiliates_select" on public.affiliates for select using (
  user_id = auth.uid()
  or parent_affiliate_id = public.my_affiliate_id()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin)
);

drop policy if exists "affiliate_referrals_select" on public.affiliate_referrals;
create policy "affiliate_referrals_select" on public.affiliate_referrals for select using (
  affiliate_id = public.my_affiliate_id()
  or affiliate_id in (select a.id from public.affiliates a where a.parent_affiliate_id = public.my_affiliate_id())
);
