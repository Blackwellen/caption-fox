-- mkt_requests_invited_supplier read marketplace_request_invites, whose own
-- SELECT policy reads marketplace_requests, so Postgres rejected every
-- marketplace_requests read at query time ("infinite recursion detected in
-- policy"). Buyers could not see their own requests: the Requests page, the
-- overview "Buyer requests" panel and the open-requests KPI all came back
-- empty even though the rows existed and the workspace policy allowed them.
--
-- Resolve the caller's supplier ids and their invited request ids through
-- SECURITY DEFINER helpers so neither policy re-enters the other.

create or replace function public.my_marketplace_supplier_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.marketplace_suppliers where user_id = auth.uid()
$$;

revoke all on function public.my_marketplace_supplier_ids() from public, anon;
grant execute on function public.my_marketplace_supplier_ids() to authenticated;

create or replace function public.my_invited_request_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select i.request_id
  from public.marketplace_request_invites i
  where i.supplier_id in (select public.my_marketplace_supplier_ids())
$$;

revoke all on function public.my_invited_request_ids() from public, anon;
grant execute on function public.my_invited_request_ids() to authenticated;

-- Same grant as before — an invited supplier sees the non-draft requests it was
-- invited to — but without re-entering the invites policy.
drop policy if exists "mkt_requests_invited_supplier" on public.marketplace_requests;
create policy "mkt_requests_invited_supplier" on public.marketplace_requests for select using (
  status <> 'draft'
  and id in (select public.my_invited_request_ids())
);

-- The invites, proposals and (where present) invite-scoped child policies can
-- now resolve the supplier side without a correlated read of the parent table.
drop policy if exists "mkt_request_invites_party" on public.marketplace_request_invites;
create policy "mkt_request_invites_party" on public.marketplace_request_invites for select using (
  request_id in (select r.id from public.marketplace_requests r where public.is_workspace_member(r.workspace_id))
  or supplier_id in (select public.my_marketplace_supplier_ids())
);

drop policy if exists "mkt_proposals_buyer" on public.marketplace_proposals;
create policy "mkt_proposals_buyer" on public.marketplace_proposals for select using (
  request_id in (select r.id from public.marketplace_requests r where public.is_workspace_member(r.workspace_id))
  or supplier_id in (select public.my_marketplace_supplier_ids())
);
