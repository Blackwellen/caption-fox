-- ============================================================
-- Creators & UGC: release hardening.
--
-- 1. Role-aware RLS. 20260901000000 gave every workspace member full
--    read/write on every Creators & UGC table, so a `viewer` (or an external
--    `ugc_creator`) could edit briefs, approve submissions or change payment
--    records straight through PostgREST. Access now mirrors the application
--    capability model in src/lib/creators/entitlements.ts:
--      read              owner, admin, manager, member, viewer
--      manage creators   owner, admin, manager
--      briefs / submissions / reviews / rights / lists   + member
--      payments: read    owner, admin, manager
--      payments: write   owner (manage_billing)
-- 2. Financial safety. Payments no longer cascade-delete with a submission or
--    creator, the status default matches the lifecycle check, and a trigger
--    enforces legal status transitions and locks paid/refunded/cancelled
--    financial fields at the database layer.
-- 3. Saved views, storage-backed thumbnails/covers/agreements, rights renewal
--    lineage and demo flags for the development seed.
-- Idempotent.
-- ============================================================

-- ── Role helper ─────────────────────────────────────────────────────────────
create or replace function public.ugc_has_role(ws uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role = any(roles)
  );
$$;
revoke all on function public.ugc_has_role(uuid, text[]) from public, anon;
grant execute on function public.ugc_has_role(uuid, text[]) to authenticated, service_role;

-- Applies the read/write split to one table. `read_roles` may select,
-- `write_roles` may insert/update/delete. Replaces every earlier policy name.
create or replace function public.ugc_apply_policies(tbl text, read_roles text[], write_roles text[], legacy text[])
returns void language plpgsql as $$
declare name text;
begin
  foreach name in array legacy loop
    execute format('drop policy if exists %I on public.%I', name, tbl);
  end loop;
  execute format('drop policy if exists %I on public.%I', tbl || '_read', tbl);
  execute format('drop policy if exists %I on public.%I', tbl || '_insert', tbl);
  execute format('drop policy if exists %I on public.%I', tbl || '_update', tbl);
  execute format('drop policy if exists %I on public.%I', tbl || '_delete', tbl);
  execute format('alter table public.%I enable row level security', tbl);
  execute format('create policy %I on public.%I for select to authenticated using (public.ugc_has_role(workspace_id, %L))',
    tbl || '_read', tbl, read_roles);
  execute format('create policy %I on public.%I for insert to authenticated with check (public.ugc_has_role(workspace_id, %L))',
    tbl || '_insert', tbl, write_roles);
  execute format('create policy %I on public.%I for update to authenticated using (public.ugc_has_role(workspace_id, %L)) with check (public.ugc_has_role(workspace_id, %L))',
    tbl || '_update', tbl, write_roles, write_roles);
  execute format('create policy %I on public.%I for delete to authenticated using (public.ugc_has_role(workspace_id, %L))',
    tbl || '_delete', tbl, write_roles);
end $$;

select public.ugc_apply_policies('ugc_creators',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager'], array['creators_workspace']);
select public.ugc_apply_policies('creator_invitations',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager'], array['creator_invitations_workspace']);
select public.ugc_apply_policies('creator_lists',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager','member'], array['creator_lists_workspace']);
select public.ugc_apply_policies('creator_list_members',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager','member'], array['creator_list_members_workspace']);
select public.ugc_apply_policies('ugc_briefs',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager','member'], array['ugc_briefs_workspace', 'briefs_workspace']);
select public.ugc_apply_policies('ugc_brief_creators',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager','member'], array['ugc_brief_creators_workspace']);
select public.ugc_apply_policies('ugc_brief_deliverables',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager','member'], array['ugc_brief_deliverables_workspace']);
select public.ugc_apply_policies('ugc_submissions',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager','member'], array['submissions_workspace']);
select public.ugc_apply_policies('ugc_submission_assets',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager','member'], array['ugc_submission_assets_workspace']);
select public.ugc_apply_policies('ugc_submission_reviews',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager','member'], array['ugc_submission_reviews_workspace']);
select public.ugc_apply_policies('ugc_submission_issues',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager','member'], array['ugc_submission_issues_workspace']);
select public.ugc_apply_policies('ugc_rights',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager','member'], array['ugc_rights_workspace']);
select public.ugc_apply_policies('ugc_rights_requests',
  array['owner','admin','manager','member','viewer'], array['owner','admin','manager','member'], array['ugc_rights_requests_workspace']);
select public.ugc_apply_policies('ugc_payments',
  array['owner','admin','manager'], array['owner'], array['ugc_payments_workspace']);
select public.ugc_apply_policies('ugc_payment_batches',
  array['owner','admin','manager'], array['owner'], array['ugc_payment_batches_workspace']);
select public.ugc_apply_policies('ugc_payout_attempts',
  array['owner','admin','manager'], array['owner'], array['ugc_payout_attempts_workspace']);

-- Activity is append-only: members who can write may add their own entries;
-- nobody updates or deletes the audit trail through the API.
drop policy if exists "ugc_activity_workspace_read" on public.ugc_activity;
drop policy if exists "ugc_activity_workspace_write" on public.ugc_activity;
drop policy if exists ugc_activity_read on public.ugc_activity;
drop policy if exists ugc_activity_insert on public.ugc_activity;
create policy ugc_activity_read on public.ugc_activity for select to authenticated
  using (public.ugc_has_role(workspace_id, array['owner','admin','manager','member','viewer']));
create policy ugc_activity_insert on public.ugc_activity for insert to authenticated
  with check (public.ugc_has_role(workspace_id, array['owner','admin','manager','member']) and actor_id = auth.uid());

-- Storage: viewers can read through signed URLs; only writers upload/delete.
drop policy if exists "ugc_submissions_member_read" on storage.objects;
create policy "ugc_submissions_member_read" on storage.objects for select using (
  bucket_id = 'ugc-submissions'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin','manager','member','viewer'))
);
drop policy if exists "ugc_submissions_member_write" on storage.objects;
create policy "ugc_submissions_member_write" on storage.objects for insert with check (
  bucket_id = 'ugc-submissions'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin','manager','member'))
);
drop policy if exists "ugc_submissions_member_delete" on storage.objects;
create policy "ugc_submissions_member_delete" on storage.objects for delete using (
  bucket_id = 'ugc-submissions'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin','manager','member'))
);

-- ── Financial safety ────────────────────────────────────────────────────────
alter table public.ugc_payments alter column status set default 'draft';

-- A payment must survive the deletion of the submission it paid for, and a
-- creator with payment history cannot be hard-deleted (archive instead).
alter table public.ugc_payments drop constraint if exists ugc_payments_submission_id_fkey;
alter table public.ugc_payments add constraint ugc_payments_submission_id_fkey
  foreign key (submission_id) references public.ugc_submissions(id) on delete set null;
alter table public.ugc_payments drop constraint if exists ugc_payments_creator_id_fkey;
alter table public.ugc_payments add constraint ugc_payments_creator_id_fkey
  foreign key (creator_id) references public.ugc_creators(id) on delete restrict;

create or replace function public.ugc_payment_transition_allowed(from_status text, to_status text)
returns boolean language sql immutable as $$
  select from_status = to_status or case from_status
    when 'draft' then to_status in ('invoice_required','in_review','cancelled')
    when 'invoice_required' then to_status in ('invoice_submitted','on_hold','cancelled')
    when 'invoice_submitted' then to_status in ('in_review','on_hold','cancelled')
    when 'in_review' then to_status in ('pending_approval','on_hold','cancelled')
    when 'pending_approval' then to_status in ('approved','in_review','on_hold','cancelled')
    when 'approved' then to_status in ('scheduled','on_hold','cancelled')
    when 'scheduled' then to_status in ('processing','on_hold','cancelled')
    when 'processing' then to_status in ('paid','partially_paid','failed')
    when 'paid' then to_status in ('refunded')
    when 'failed' then to_status in ('scheduled','on_hold','cancelled')
    when 'on_hold' then to_status in ('in_review','pending_approval','cancelled')
    when 'partially_paid' then to_status in ('paid','failed')
    else false
  end;
$$;

create or replace function public.ugc_payments_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status
       and not public.ugc_payment_transition_allowed(old.status, new.status) then
      raise exception 'Invalid payment status transition from % to %', old.status, new.status
        using errcode = 'check_violation';
    end if;
    if old.status in ('paid','refunded','cancelled') and (
      new.amount is distinct from old.amount
      or new.currency is distinct from old.currency
      or new.creator_id is distinct from old.creator_id
      or new.paid_at is distinct from old.paid_at
    ) then
      raise exception 'Payment % is % and its financial fields are locked; record a correction instead', old.id, old.status
        using errcode = 'check_violation';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_ugc_payments_guard on public.ugc_payments;
create trigger trg_ugc_payments_guard before insert or update on public.ugc_payments
  for each row execute function public.ugc_payments_guard();

-- ── New columns ─────────────────────────────────────────────────────────────
-- Storage paths in the private ugc-submissions bucket. Read back only through
-- signed URLs; the legacy *_url columns stay for externally hosted media.
alter table public.ugc_submissions add column if not exists thumbnail_path text;
alter table public.ugc_briefs add column if not exists cover_path text;
alter table public.ugc_rights add column if not exists agreement_path text;
alter table public.ugc_rights add column if not exists renewed_from_id uuid references public.ugc_rights(id) on delete set null;

-- Development seed flags (scripts/seed-creators-demo.mjs removes rows by these).
alter table public.ugc_creators add column if not exists is_demo boolean not null default false;
alter table public.ugc_briefs add column if not exists is_demo boolean not null default false;
alter table public.ugc_payments add column if not exists is_demo boolean not null default false;
alter table public.ugc_payment_batches add column if not exists is_demo boolean not null default false;
alter table public.ugc_activity add column if not exists is_demo boolean not null default false;
alter table public.creator_lists add column if not exists is_demo boolean not null default false;
alter table public.creator_invitations add column if not exists is_demo boolean not null default false;

create index if not exists idx_ugc_submissions_workspace_rights on public.ugc_submissions(workspace_id, rights_status);
create index if not exists idx_ugc_payments_workspace_submitted on public.ugc_payments(workspace_id, submitted_date desc);

-- ── Saved views ─────────────────────────────────────────────────────────────
-- Personal by default; `is_shared` makes a view visible to the workspace. The
-- stored query is re-validated by the page parser on load, so a shared view
-- can never widen a user's data scope.
create table if not exists public.creator_saved_views (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  surface text not null check (surface in ('creators','briefs','submissions','rights','payments')),
  name text not null check (char_length(name) between 1 and 60),
  query jsonb not null default '{}',
  is_shared boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, owner_id, surface, name)
);
alter table public.creator_saved_views enable row level security;
drop policy if exists creator_saved_views_read on public.creator_saved_views;
create policy creator_saved_views_read on public.creator_saved_views for select to authenticated using (
  public.ugc_has_role(workspace_id, array['owner','admin','manager','member','viewer'])
  and (owner_id = auth.uid() or is_shared)
);
drop policy if exists creator_saved_views_write on public.creator_saved_views;
create policy creator_saved_views_write on public.creator_saved_views for all to authenticated
  using (owner_id = auth.uid() and public.ugc_has_role(workspace_id, array['owner','admin','manager','member','viewer']))
  with check (owner_id = auth.uid() and public.ugc_has_role(workspace_id, array['owner','admin','manager','member','viewer']));
create index if not exists idx_creator_saved_views_lookup on public.creator_saved_views(workspace_id, surface, owner_id);
